import json
import os
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
import torch
import torch.nn as nn
import torch.nn.functional as F
import torchvision.transforms as T

from models.detector import detect_face

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

BACKEND_DIR = Path(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW_IMAGES_DIR = BACKEND_DIR / "database" / "Rawimage"
PREPROCESSED_DIR = BACKEND_DIR / "database" / "preprocessed_faces"
CHECKPOINT_PATH = BACKEND_DIR / "weights" / "epoch_15.pth"
EMBEDDINGS_PATH = BACKEND_DIR / "epoch_embeddings.json"
EMBEDDINGS_META_PATH = BACKEND_DIR / "epoch_embeddings_meta.json"
LEGACY_EMBEDDINGS_FILE = BACKEND_DIR / "embeddings.json"

MATCH_THRESHOLD = 0.78
PERSON_MEAN_THRESHOLD = 0.70
TOP_MATCH_MARGIN = 0.010
STRONG_ACCEPT_SCORE = 0.92
STRONG_ACCEPT_MEAN = 0.85
MIN_FACE_SIZE = 20

UNKNOWN_LABEL = "INTRUDER"
UNCERTAIN_LABEL = "UNCERTAIN"


class FaceCNN(nn.Module):
    def __init__(self, embedding_size=512):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(3, 64, 3, padding=1), nn.BatchNorm2d(64), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(64, 128, 3, padding=1), nn.BatchNorm2d(128), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(128, 256, 3, padding=1), nn.BatchNorm2d(256), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(256, 512, 3, padding=1), nn.BatchNorm2d(512), nn.ReLU(), nn.MaxPool2d(2),
        )
        self.fc = nn.Linear(512 * 7 * 7, embedding_size)
        self.bn = nn.BatchNorm1d(embedding_size)
        self.drop = nn.Dropout(0.3)

    def forward(self, x):
        x = self.features(x)
        x = x.view(x.size(0), -1)
        x = self.drop(self.bn(self.fc(x)))
        x = F.normalize(x, p=2, dim=1)
        return x


INFER_TRANSFORM = T.Compose([
    T.Resize((112, 112)),
    T.ToTensor(),
    T.Normalize([0.5, 0.5, 0.5], [0.5, 0.5, 0.5]),
])

_model = None
_embedding_db = None
_embedding_signature = None


def normalize_identity_label(label):
    return str(label).replace('_', ' ').strip()


def l2_normalize(vector):
    vector = np.array(vector, dtype=np.float32)
    return vector / (np.linalg.norm(vector) + 1e-8)


def cosine_similarity(a, b):
    return float(np.dot(a, b) / ((np.linalg.norm(a) * np.linalg.norm(b)) + 1e-8))


def load_model():
    global _model
    if _model is not None:
        return _model

    if not CHECKPOINT_PATH.exists():
        raise FileNotFoundError(
            f"Recognition checkpoint not found at {CHECKPOINT_PATH}. "
            "Place epoch_15.pth inside backend/weights."
        )

    checkpoint = torch.load(CHECKPOINT_PATH, map_location=DEVICE)
    model = FaceCNN(embedding_size=512).to(DEVICE)
    model.load_state_dict(checkpoint["model"])
    model.eval()
    _model = model
    print("FaceCNN recognition model loaded.")
    return _model


def get_embedding(pil_image):
    model = load_model()
    tensor = INFER_TRANSFORM(pil_image.convert("RGB")).unsqueeze(0).to(DEVICE)
    with torch.no_grad():
        embedding = model(tensor)
    return embedding.cpu().numpy()[0]


def collect_image_files(folder):
    exts = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
    return sorted([p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in exts])


def build_source_signature():
    signature = {}
    if not RAW_IMAGES_DIR.exists():
        return signature

    for person_dir in sorted([p for p in RAW_IMAGES_DIR.iterdir() if p.is_dir()]):
        files = collect_image_files(person_dir)
        signature[person_dir.name] = [
            {"name": img.name, "size": int(img.stat().st_size), "mtime": float(img.stat().st_mtime)}
            for img in files
        ]
    return signature


def embeddings_are_current():
    if not EMBEDDINGS_PATH.exists() or not EMBEDDINGS_META_PATH.exists():
        return False

    with open(EMBEDDINGS_META_PATH, "r", encoding="utf-8") as f:
        meta = json.load(f)
    return meta.get("source_signature") == build_source_signature()


def _extract_face_rgb(image_bgr):
    result = detect_face(image_bgr)
    if result is None:
        return None, None

    pil_face, x1, y1, x2, y2 = result
    if x2 - x1 < MIN_FACE_SIZE or y2 - y1 < MIN_FACE_SIZE:
        return None, None

    return np.array(pil_face), (x1, y1, x2, y2)


def generate_embeddings():
    if not RAW_IMAGES_DIR.exists():
        raise FileNotFoundError(f"Raw image folder not found: {RAW_IMAGES_DIR}")

    PREPROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    database = {}

    person_dirs = sorted([p for p in RAW_IMAGES_DIR.iterdir() if p.is_dir()])
    if not person_dirs:
        raise RuntimeError(f"No person folders found in {RAW_IMAGES_DIR}")

    print(f"Generating epoch_15 embeddings for {len(person_dirs)} people...")
    for person_dir in person_dirs:
        person_name = person_dir.name
        image_files = collect_image_files(person_dir)
        if not image_files:
            continue

        embeddings = []
        save_dir = PREPROCESSED_DIR / person_name
        save_dir.mkdir(parents=True, exist_ok=True)

        for image_path in image_files:
            image_bgr = cv2.imread(str(image_path))
            if image_bgr is None:
                continue

            face_rgb, box = _extract_face_rgb(image_bgr)
            if face_rgb is None:
                print(f"No face detected in {image_path.name}, skipping.")
                continue

            embedding = l2_normalize(get_embedding(Image.fromarray(face_rgb)))
            embeddings.append(embedding)

            x1, y1, x2, y2 = box
            face_bgr = image_bgr[y1:y2, x1:x2]
            save_path = save_dir / f"{image_path.stem}_cropped.jpg"
            cv2.imwrite(str(save_path), face_bgr)

        if not embeddings:
            continue

        mean_embedding = l2_normalize(np.mean(np.stack(embeddings, axis=0), axis=0))
        database[person_name] = {
            "mean": mean_embedding.tolist(),
            "samples": [emb.tolist() for emb in embeddings],
        }
        print(f"Saved {len(embeddings)} FaceCNN embeddings for {person_name}.")

    with open(EMBEDDINGS_PATH, "w", encoding="utf-8") as f:
        json.dump(database, f, indent=2)

    with open(EMBEDDINGS_META_PATH, "w", encoding="utf-8") as f:
        json.dump({"source_signature": build_source_signature()}, f, indent=2)

    return load_embeddings()


def load_embeddings():
    if not EMBEDDINGS_PATH.exists():
        return {}

    with open(EMBEDDINGS_PATH, "r", encoding="utf-8") as f:
        raw = json.load(f)

    parsed = {}
    for name, item in raw.items():
        if isinstance(item, dict) and "mean" in item and "samples" in item:
            parsed[name] = {
                "mean": np.array(item["mean"], dtype=np.float32),
                "samples": [np.array(sample, dtype=np.float32) for sample in item["samples"]],
            }
        else:
            emb = np.array(item, dtype=np.float32)
            parsed[name] = {"mean": emb, "samples": [emb]}
    return parsed


def ensure_embeddings():
    global _embedding_db, _embedding_signature
    current_signature = build_source_signature()

    if _embedding_db is not None and _embedding_signature == current_signature:
        return _embedding_db

    if embeddings_are_current():
        _embedding_db = load_embeddings()
    else:
        print("FaceCNN embeddings missing or outdated. Rebuilding them now...")
        _embedding_db = generate_embeddings()

    _embedding_signature = current_signature
    return _embedding_db


def get_recognition_embeddings():
    return ensure_embeddings()


def recognition_source_name():
    return EMBEDDINGS_PATH.name


def compare_embedding(query_emb, embeddings=None):
    if embeddings is None:
        embeddings = get_recognition_embeddings()
    if not embeddings:
        return None, -1.0

    person_results = []

    for person_name, person_data in embeddings.items():
        sample_scores = [cosine_similarity(query_emb, sample) for sample in person_data["samples"]]
        mean_score = cosine_similarity(query_emb, person_data["mean"])
        top_sample_score = max(sample_scores) if sample_scores else -1.0
        combined_score = max(top_sample_score, mean_score)
        person_results.append({
            "name": person_name,
            "score": combined_score,
            "mean_score": mean_score,
            "top_sample_score": top_sample_score,
        })

    if not person_results:
        return None, -1.0

    person_results.sort(key=lambda item: item["score"], reverse=True)
    best = person_results[0]
    second_best_score = person_results[1]["score"] if len(person_results) > 1 else -1.0

    strong_accept = (
        best["score"] >= STRONG_ACCEPT_SCORE and
        best["mean_score"] >= STRONG_ACCEPT_MEAN
    )

    low_confidence = (
        best["score"] < MATCH_THRESHOLD or
        best["mean_score"] < PERSON_MEAN_THRESHOLD
    )
    low_margin = second_best_score >= 0 and (best["score"] - second_best_score) < TOP_MATCH_MARGIN

    if low_confidence and not strong_accept:
        return UNKNOWN_LABEL, best["score"]

    if low_margin and not strong_accept:
        return UNCERTAIN_LABEL, best["score"]

    return best["name"], best["score"]


def recognize_face(pil_face):
    embeddings = get_recognition_embeddings()
    if not embeddings:
        return None, -1.0

    query_emb = l2_normalize(get_embedding(pil_face))
    return compare_embedding(query_emb, embeddings)


def save_embeddings(embeddings_dict):
    serializable = {k: np.array(v).tolist() for k, v in embeddings_dict.items()}
    with open(LEGACY_EMBEDDINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(serializable, f)


def generate_voter_embedding(voter_id, photo_path):
    image_bgr = cv2.imread(photo_path)
    if image_bgr is None:
        return False

    face_rgb, _ = _extract_face_rgb(image_bgr)
    if face_rgb is None:
        return False

    try:
        embedding = l2_normalize(get_embedding(Image.fromarray(face_rgb)))
        embeddings = {}
        if LEGACY_EMBEDDINGS_FILE.exists():
            with open(LEGACY_EMBEDDINGS_FILE, "r", encoding="utf-8") as f:
                embeddings = json.load(f)
        embeddings[voter_id] = embedding.tolist()
        with open(LEGACY_EMBEDDINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(embeddings, f)
        return True
    except Exception:
        return False
