# routes/verify.py — Face verification endpoint
# Uses custom FaceCNN + YOLO matching friend's live_demonstration.py logic

import pathlib
pathlib.PosixPath = pathlib.WindowsPath

from flask import Blueprint, request, jsonify, current_app
from database.db import get_db
from models.detector import detect_face
from models.recognizer import recognize_face, MATCH_THRESHOLD, INTRUDER_THRESHOLD
from middleware import token_required
import base64
import numpy as np
import cv2
import os
from datetime import datetime

verify_bp = Blueprint('verify', __name__)

def decode_base64_image(base64_string):
    """Convert base64 image from React webcam to OpenCV numpy array."""
    if ',' in base64_string:
        base64_string = base64_string.split(',')[1]
    img_bytes = base64.b64decode(base64_string)
    np_arr    = np.frombuffer(img_bytes, np.uint8)
    img       = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    return img


@verify_bp.route('/verify', methods=['POST'])
@token_required
def verify():
    data         = request.get_json()
    base64_image = data.get('image')

    if not base64_image:
        return jsonify({'status': 'error', 'message': 'No image received', 'confidence': 0}), 400

    # Step 1 — Decode base64 to OpenCV image
    frame = decode_base64_image(base64_image)
    if frame is None:
        return jsonify({'status': 'error', 'message': 'Could not decode image', 'confidence': 0}), 400

    # Step 2 — YOLO face detection
    result = detect_face(frame)
    if result is None:
        return jsonify({
            'status':     'no_face',
            'message':    'No face detected. Please face the camera directly.',
            'confidence': 0
        }), 200

    pil_face = result[0]  # PIL image

    # Step 3 — FaceCNN recognition (cosine similarity)
    match_voter_id, score = recognize_face(pil_face)

    # score is cosine similarity (0 to 1, higher = more similar)
    confidence = round(score * 100, 2)

    db = get_db()

    # Step 4 — Apply thresholds (matching friend's logic)
    if score >= MATCH_THRESHOLD:
        # High confidence — recognized voter
        voter = db.execute(
            'SELECT * FROM voters WHERE voter_id = ?', (match_voter_id,)
        ).fetchone()

        if not voter:
            return jsonify({
                'status':     'intruder',
                'name':       'Unknown',
                'message':    'Face matched but voter not found in database',
                'confidence': confidence
            }), 200

        if voter['has_voted']:
            return jsonify({
                'status':     'duplicate',
                'name':       voter['name'],
                'message':    'Already Voted — Duplicate Detected',
                'confidence': confidence
            }), 200

        # Mark as voted
        db.execute(
            'UPDATE voters SET has_voted = 1 WHERE voter_id = ?',
            (match_voter_id,)
        )
        db.commit()

        return jsonify({
            'status':     'authorized',
            'name':       voter['name'],
            'message':    'Identity Verified — Proceed to Vote',
            'confidence': confidence
        }), 200

    elif score >= INTRUDER_THRESHOLD:
        # Uncertain — not confident enough
        return jsonify({
            'status':     'no_face',
            'message':    f'Uncertain match ({confidence}%) — please face camera clearly',
            'confidence': confidence
        }), 200

    else:
        # Low confidence — intruder
        timestamp_str  = datetime.now().strftime('%Y%m%d_%H%M%S')
        image_filename = f"intruder_{timestamp_str}.jpg"
        image_save_path = os.path.join(
            current_app.config['INTRUDER_CAPTURES_FOLDER'],
            image_filename
        )
        cv2.imwrite(image_save_path, frame)

        db.execute('''
            INSERT INTO intruders (image_path, location, confidence)
            VALUES (?, ?, ?)
        ''', (f"intruder_captures/{image_filename}", 'Polling Station A', confidence))
        db.commit()

        return jsonify({
            'status':     'intruder',
            'name':       'Unknown Person',
            'message':    f'Access Denied — Score {confidence}% below threshold',
            'confidence': confidence,
            'image_path': f"intruder_captures/{image_filename}"
        }), 200