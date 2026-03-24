# models/recognizer.py — Custom FaceCNN Face Recognition
# Matches friend's generate_embeddings.py and live_demonstration.py exactly

import torch
import torch.nn as nn
import torch.nn.functional as F
import torchvision.transforms as transforms
import numpy as np
from PIL import Image
import json
import cv2
import os

from models.detector import detect_face

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

BACKEND_DIR     = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHECKPOINT_PATH = os.path.join(BACKEND_DIR, 'weights', 'epoch_15.pth')
EMBEDDINGS_FILE = os.path.join(BACKEND_DIR, 'embeddings.json')

# Thresholds — matching friend's live_demonstration.py
MATCH_THRESHOLD    = 0.78
INTRUDER_THRESHOLD = 0.65

# ── Custom FaceCNN model (same architecture as friend's code) ─────────────
class FaceCNN(nn.Module):
    def __init__(self, embedding_size=512):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(3,   64,  3, padding=1), nn.BatchNorm2d(64),  nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(64,  128, 3, padding=1), nn.BatchNorm2d(128), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(128, 256, 3, padding=1), nn.BatchNorm2d(256), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(256, 512, 3, padding=1), nn.BatchNorm2d(512), nn.ReLU(), nn.MaxPool2d(2),
        )
        self.fc   = nn.Linear(512 * 7 * 7, embedding_size)
        self.bn   = nn.BatchNorm1d(embedding_size)
        self.drop = nn.Dropout(0.3)

    def forward(self, x):
        x = self.features(x)
        x = x.view(x.size(0), -1)
        x = self.drop(self.bn(self.fc(x)))
        x = F.normalize(x, p=2, dim=1)
        return x

# Transform — matches friend's infer_tf
infer_tf = transforms.Compose([
    transforms.Resize((112, 112)),
    transforms.ToTensor(),
    transforms.Normalize([0.5]*3, [0.5]*3),
])

_model = None

def load_model():
    global _model
    if _model is None:
        print("Loading FaceCNN recognition model...")
        ckpt   = torch.load(CHECKPOINT_PATH, map_location=DEVICE)
        _model = FaceCNN(embedding_size=512).to(DEVICE)
        _model.load_state_dict(ckpt['model'])
        _model.eval()
        print("FaceCNN loaded.")
    return _model

def get_embedding(pil_image):
    """Convert PIL image to 512-dim embedding vector."""
    model = load_model()
    t = infer_tf(pil_image.convert("RGB")).unsqueeze(0).to(DEVICE)
    with torch.no_grad():
        return model(t).cpu().numpy()[0]

def cosine_sim(a, b):
    """Cosine similarity between two vectors."""
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-8))

def load_embeddings():
    """Load embeddings from JSON file. Format: {voter_id: [embedding_list]}"""
    if not os.path.exists(EMBEDDINGS_FILE):
        return {}
    with open(EMBEDDINGS_FILE, 'r') as f:
        raw = json.load(f)
    return {k: np.array(v) for k, v in raw.items()}

def save_embeddings(embeddings_dict):
    """Save embeddings dict to JSON. Converts numpy arrays to lists."""
    serializable = {k: v.tolist() for k, v in embeddings_dict.items()}
    with open(EMBEDDINGS_FILE, 'w') as f:
        json.dump(serializable, f)

def recognize_face(pil_face):
    """
    Compare face PIL image against all stored voter embeddings.
    Returns (voter_id, score) of best match.
    Returns (None, 0.0) if no embeddings exist.
    """
    embeddings = load_embeddings()
    if not embeddings:
        return None, 0.0

    query_emb = get_embedding(pil_face)
    query_emb = query_emb / (np.linalg.norm(query_emb) + 1e-8)

    best_voter_id = None
    best_score    = 0.0

    for voter_id, stored_emb in embeddings.items():
        score = cosine_sim(query_emb, stored_emb)
        if score > best_score:
            best_score    = score
            best_voter_id = voter_id

    return best_voter_id, best_score

def generate_voter_embedding(voter_id, photo_path):
    """
    Generate and save face embedding for a newly registered voter.
    Runs YOLO detection then FaceCNN embedding.
    """
    frame = cv2.imread(photo_path)
    if frame is None:
        print(f"Could not read image: {photo_path}")
        return False

    result = detect_face(frame)
    if result is None:
        print(f"No face detected in: {photo_path}")
        return False

    pil_face = result[0]  # PIL image from detect_face

    try:
        embedding = get_embedding(pil_face)
        # Normalize like friend's code
        embedding = embedding / (np.linalg.norm(embedding) + 1e-8)

        embeddings = load_embeddings()
        embeddings[voter_id] = embedding
        save_embeddings(embeddings)
        print(f"Embedding saved for voter: {voter_id}")
        return True
    except Exception as e:
        print(f"Embedding failed: {e}")
        return False