# models/recognizer.py — FaceNet Face Recognition

import torch
import numpy as np
import pickle
import cv2
import os
from PIL import Image
import torchvision.transforms as transforms
from facenet_pytorch import InceptionResnetV1
from models.detector import detect_face

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
EMBEDDINGS_FILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    'embeddings.pkl'
)

_facenet = None

def load_facenet():
    global _facenet
    if _facenet is None:
        print("Loading FaceNet model...")
        _facenet = InceptionResnetV1(pretrained='vggface2').eval().to(DEVICE)
        print("FaceNet loaded.")
    return _facenet

transform = transforms.Compose([
    transforms.Resize((160, 160)),
    transforms.ToTensor()
])

def load_embeddings():
    if not os.path.exists(EMBEDDINGS_FILE):
        return {}
    with open(EMBEDDINGS_FILE, 'rb') as f:
        return pickle.load(f)

def save_embeddings(embeddings):
    with open(EMBEDDINGS_FILE, 'wb') as f:
        pickle.dump(embeddings, f)

def get_face_embedding(face_crop):
    model = load_facenet()
    face_rgb = cv2.cvtColor(face_crop, cv2.COLOR_BGR2RGB)
    face_pil = Image.fromarray(face_rgb)
    face_tensor = transform(face_pil).unsqueeze(0).to(DEVICE)
    with torch.no_grad():
        embedding = model(face_tensor).cpu().numpy()[0]
    return embedding

def recognize_face(face_crop):
    """
    Compare face crop against all stored voter embeddings.
    Returns (voter_id, distance) of closest match.
    """
    embeddings = load_embeddings()

    if not embeddings:
        return None, 999

    query_embedding = get_face_embedding(face_crop)

    best_voter_id = None
    best_distance = float('inf')

    for voter_id, stored_embedding in embeddings.items():
        distance = np.linalg.norm(stored_embedding - query_embedding)
        if distance < best_distance:
            best_distance = distance
            best_voter_id = voter_id

    return best_voter_id, best_distance

def generate_voter_embedding(voter_id, photo_path):
    """
    Generate and save face embedding for a new voter.
    Uses YOLO to detect face first, then FaceNet for embedding.
    """
    frame = cv2.imread(photo_path)
    if frame is None:
        return False

    # Detect face (currently returns full frame as placeholder)
    face_crop = detect_face(frame)
    if face_crop is None:
        return False

    try:
        embedding = get_face_embedding(face_crop)
        embeddings = load_embeddings()
        embeddings[voter_id] = embedding
        save_embeddings(embeddings)
        print(f"Embedding generated for voter: {voter_id}")
        return True
    except Exception as e:
        print(f"Embedding generation failed: {e}")
        return False