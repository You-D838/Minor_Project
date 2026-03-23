# routes/verify.py — Face verification endpoint

import pathlib
pathlib.PosixPath = pathlib.WindowsPath

from flask import Blueprint, request, jsonify, current_app
from database.db import get_db
from models.detector import detect_face
from models.recognizer import recognize_face
from middleware import token_required
import base64
import numpy as np
import cv2
import os
from datetime import datetime

verify_bp = Blueprint('verify', __name__)

def decode_base64_image(base64_string):
    """Convert base64 image string from React to OpenCV numpy array"""
    # Strip prefix: data:image/jpeg;base64,
    if ',' in base64_string:
        base64_string = base64_string.split(',')[1]

    img_bytes = base64.b64decode(base64_string)
    np_arr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    return img


@verify_bp.route('/verify', methods=['POST'])
@token_required
def verify():
    data = request.get_json()
    base64_image = data.get('image')

    if not base64_image:
        return jsonify({'status': 'error', 'message': 'No image received'}), 400

    # Step 1 — Decode base64 to OpenCV BGR image
    frame = decode_base64_image(base64_image)
    if frame is None:
        return jsonify({'status': 'error', 'message': 'Could not decode image'}), 400

    # Step 2 — YOLO face detection
    face_crop = detect_face(frame)
    if face_crop is None:
        return jsonify({
            'status': 'no_face',
            'message': 'No face detected. Please face the camera directly.',
            'confidence': 0
        }), 200

    # Step 3 — FaceNet recognition
    match_voter_id, distance = recognize_face(face_crop)

    # Step 4 — Convert Euclidean distance to confidence %
    # distance 0.0 = 100%, distance >= 0.8 = 0%
    DISTANCE_THRESHOLD = 0.8
    confidence = round(max(0.0, (1 - (distance / DISTANCE_THRESHOLD))) * 100, 2)

    db = get_db()

    # Step 5 — Apply 90% threshold
    if confidence >= 90:
        voter = db.execute(
            'SELECT * FROM voters WHERE voter_id = ?', (match_voter_id,)
        ).fetchone()

        if not voter:
            return jsonify({
                'status': 'intruder',
                'name': 'Unknown',
                'message': 'Face matched but voter not found in database',
                'confidence': confidence
            }), 200

        if voter['has_voted']:
            return jsonify({
                'status': 'duplicate',
                'name': voter['name'],
                'message': 'Already Voted — Duplicate Detected',
                'confidence': confidence
            }), 200

        # Mark voter as voted
        db.execute(
            'UPDATE voters SET has_voted = 1 WHERE voter_id = ?',
            (match_voter_id,)
        )
        db.commit()

        return jsonify({
            'status': 'authorized',
            'name': voter['name'],
            'message': 'Identity Verified — Proceed to Vote',
            'confidence': confidence
        }), 200

    else:
        # Low confidence — save intruder capture
        timestamp_str = datetime.now().strftime('%Y%m%d_%H%M%S')
        image_filename = f"intruder_{timestamp_str}.jpg"
        image_save_path = os.path.join(
            current_app.config['INTRUDER_CAPTURES_FOLDER'],
            image_filename
        )
        cv2.imwrite(image_save_path, frame)

        # Save intruder record to database
        db.execute('''
            INSERT INTO intruders (image_path, location, confidence)
            VALUES (?, ?, ?)
        ''', (
            f"intruder_captures/{image_filename}",
            'Polling Station A',
            confidence
        ))
        db.commit()

        return jsonify({
            'status': 'intruder',
            'name': 'Unknown Person',
            'message': f'Access Denied — Confidence {confidence}% is below 90% threshold',
            'confidence': confidence,
            'image_path': f"intruder_captures/{image_filename}"
        }), 200
