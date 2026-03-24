# models/detector.py — YOLO Face Detection
# Uses torch.hub to load YOLOv5 with custom best.pt weights

import pathlib
pathlib.PosixPath = pathlib.WindowsPath

import torch
import cv2
import os
import sys

BACKEND_DIR  = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEIGHTS_PATH = os.path.join(BACKEND_DIR, 'weights', 'best.pt')
HUB_DIR      = os.path.join(os.path.expanduser('~'), '.cache', 'torch', 'hub', 'ultralytics_yolov5_master')

if HUB_DIR not in sys.path:
    sys.path.insert(0, HUB_DIR)

_yolo_model = None

def load_yolo():
    global _yolo_model
    if _yolo_model is None:
        print("Loading YOLO model...")
        original_dir = os.getcwd()
        os.chdir(HUB_DIR)
        sys.path.insert(0, HUB_DIR)
        try:
            _yolo_model = torch.hub.load(
                HUB_DIR,
                'custom',
                path=WEIGHTS_PATH,
                source='local',
                force_reload=False,
                trust_repo=True
            )
            _yolo_model.conf = 0.4
            print("YOLO model loaded.")
        finally:
            os.chdir(original_dir)
    return _yolo_model

def detect_face(frame):
    """
    Takes OpenCV BGR frame.
    Returns (face_crop_pil, x1, y1, x2, y2) of best detection, or None.
    """
    from PIL import Image

    try:
        model = load_yolo()
    except Exception as e:
        print(f"YOLO load failed: {e} — using full frame fallback")
        # Fallback: return full frame as PIL
        h, w = frame.shape[:2]
        pil = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        return pil, 0, 0, w, h

    results    = model(frame)
    detections = results.xyxy[0].cpu().numpy()
    h, w       = frame.shape[:2]

    if len(detections) == 0:
        return None

    # Pick highest confidence detection
    best        = detections[detections[:, 4].argmax()]
    x1, y1, x2, y2 = map(int, best[:4])
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(w, x2), min(h, y2)

    if x2 - x1 < 20 or y2 - y1 < 20:
        return None

    crop     = frame[y1:y2, x1:x2]
    pil_crop = Image.fromarray(cv2.cvtColor(crop, cv2.COLOR_BGR2RGB))
    return pil_crop, x1, y1, x2, y2