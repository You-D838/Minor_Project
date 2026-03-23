# models/detector.py — YOLO Face Detection
# NOTE: YOLO integration pending — to be completed by teammate
# Currently returns a placeholder so registration works without face detection

import cv2

def detect_face(frame):
    """
    Placeholder — returns the full frame as face crop.
    Replace with actual YOLO detection when environment is ready.
    """
    if frame is None or frame.shape[0] == 0 or frame.shape[1] == 0:
        return None
    return frame