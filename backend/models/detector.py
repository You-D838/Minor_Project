import pathlib
pathlib.PosixPath = pathlib.WindowsPath

import os
import sys
from contextlib import contextmanager

import cv2
import torch

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEIGHTS_PATH = os.path.join(BACKEND_DIR, 'weights', 'best.pt')
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

_yolo_model = None
_yolo_error = None


def _candidate_repo_dirs():
    home = os.path.expanduser('~')
    env_repo = os.environ.get('YOLOV5_REPO')
    candidates = [
        env_repo,
        os.path.join(BACKEND_DIR, 'yolov5'),
        os.path.join(home, '.cache', 'torch', 'hub', 'ultralytics_yolov5_master'),
        os.path.join(home, '.cache', 'torch', 'hub', 'ultralytics_yolov5_master-master'),
    ]

    seen = set()
    existing = []

    for path in candidates:
        if not path:
            continue
        normalized = os.path.normpath(path)
        if normalized in seen:
            continue
        seen.add(normalized)
        if os.path.isdir(normalized):
            existing.append(normalized)

    return existing


@contextmanager
def _yolo_import_context(repo_dir):
    original_dir = os.getcwd()
    original_sys_path = list(sys.path)
    original_sys_modules = dict(sys.modules)

    # Keep the YOLO repo first so `models.common` resolves to YOLOv5,
    # not this app's own `backend/models` package.
    filtered_sys_path = [
        path for path in original_sys_path
        if os.path.normpath(path) != os.path.normpath(BACKEND_DIR)
    ]
    sys.path[:] = [repo_dir] + filtered_sys_path

    # `models` may already be cached from this Flask app's own package.
    # Remove those cached entries for the duration of the YOLO import.
    for module_name in list(sys.modules.keys()):
        if module_name == 'models' or module_name.startswith('models.'):
            sys.modules.pop(module_name, None)

    try:
        os.chdir(repo_dir)
        yield
    finally:
        os.chdir(original_dir)
        sys.path[:] = original_sys_path
        sys.modules.clear()
        sys.modules.update(original_sys_modules)


def _load_from_local_repo(repo_dir):
    with _yolo_import_context(repo_dir):
        model = torch.hub.load(
            repo_or_dir=repo_dir,
            model='custom',
            path=WEIGHTS_PATH,
            source='local',
            force_reload=False,
            trust_repo=True
        )
        model.conf = 0.4
        model.to(DEVICE)
        model.eval()
        return model


def load_yolo():
    global _yolo_model, _yolo_error

    if _yolo_model is not None:
        return _yolo_model

    print("Loading YOLO model...")

    if not os.path.exists(WEIGHTS_PATH):
        raise FileNotFoundError(
            f"YOLO weights not found at {WEIGHTS_PATH}. "
            "Place best.pt inside backend/weights."
        )

    load_errors = []

    for repo_dir in _candidate_repo_dirs():
        try:
            print(f"Trying YOLO repo: {repo_dir}")
            _yolo_model = _load_from_local_repo(repo_dir)
            _yolo_error = None
            print("YOLO model loaded.")
            return _yolo_model
        except Exception as e:
            load_errors.append(f"{repo_dir}: {e}")

    try:
        print("Trying YOLO download fallback from ultralytics/yolov5...")
        _yolo_model = torch.hub.load(
            repo_or_dir='ultralytics/yolov5',
            model='custom',
            path=WEIGHTS_PATH,
            force_reload=False,
            trust_repo=True
        )
        _yolo_model.conf = 0.4
        _yolo_model.to(DEVICE)
        _yolo_model.eval()
        _yolo_error = None
        print("YOLO model loaded.")
        return _yolo_model
    except Exception as e:
        load_errors.append(f"ultralytics/yolov5: {e}")
        _yolo_error = " | ".join(load_errors) if load_errors else str(e)
        raise RuntimeError(
            "Unable to load YOLOv5. Put a YOLOv5 repo in backend/yolov5, "
            "or set the YOLOV5_REPO environment variable, or make sure the "
            "Torch hub cache contains ultralytics_yolov5_master."
        ) from e


def detect_face(frame):
    """
    Takes OpenCV BGR frame.
    Returns (face_crop_pil, x1, y1, x2, y2) of best detection, or None.
    """
    from PIL import Image

    try:
        model = load_yolo()
    except Exception as e:
        details = _yolo_error or str(e)
        print(f"YOLO load failed: {details} - using full frame fallback")
        h, w = frame.shape[:2]
        pil = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        return pil, 0, 0, w, h

    results = model(frame)
    detections = results.xyxy[0].cpu().numpy()
    h, w = frame.shape[:2]

    if len(detections) == 0:
        return None

    # Match the local demo logic: use the largest detected face.
    best = max(detections, key=lambda det: (det[2] - det[0]) * (det[3] - det[1]))
    x1, y1, x2, y2 = map(int, best[:4])
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(w, x2), min(h, y2)

    if x2 - x1 < 20 or y2 - y1 < 20:
        return None

    crop = frame[y1:y2, x1:x2]
    pil_crop = Image.fromarray(cv2.cvtColor(crop, cv2.COLOR_BGR2RGB))
    return pil_crop, x1, y1, x2, y2
