import pathlib
pathlib.PosixPath = pathlib.WindowsPath

import base64
from collections import defaultdict, deque
from datetime import datetime
import hashlib
import json
import os
import time

import cv2
from flask import Blueprint, current_app, jsonify, request
import numpy as np

from database.db import get_db
from middleware import token_required
from models.detector import detect_face
from models.recognizer import (
    MATCH_THRESHOLD,
    PERSON_MEAN_THRESHOLD,
    STRONG_ACCEPT_MEAN,
    STRONG_ACCEPT_SCORE,
    TOP_MATCH_MARGIN,
    UNCERTAIN_LABEL,
    UNKNOWN_LABEL,
    get_embedding,
    l2_normalize,
    normalize_identity_label,
)

verify_bp = Blueprint('verify', __name__)

FRAME_BUFFER_SIZE = 10
EMBEDDING_FACE_CHANGE_THRESHOLD = 0.65
INTRUDER_LOG_COOLDOWN_SECONDS = 12
INTRUDER_EMBEDDING_SIMILARITY = 0.90
INTRUDER_PHASH_WINDOW_SECONDS = 60
DUPLICATE_INTRUDER_MIN_INTERVAL_PER_CLIENT = 20
DUPLICATE_GRACE_SECONDS = 30

frame_buffers = defaultdict(lambda: deque(maxlen=FRAME_BUFFER_SIZE))
recent_intruder_events = deque(maxlen=50)
recent_intruder_phashes = deque(maxlen=200)
recent_intruder_per_client = {}
recent_authorized_voters = {}

_db_embedding_cache = None
_db_embedding_cache_key = None


def decode_base64_image(base64_string):
    if ',' in base64_string:
        base64_string = base64_string.split(',')[1]
    img_bytes = base64.b64decode(base64_string)
    np_arr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    return img


def verification_client_key():
    auth_header = request.headers.get('Authorization', '')
    remote_addr = request.remote_addr or 'unknown'
    raw_key = f"{remote_addr}|{auth_header}"
    return hashlib.sha256(raw_key.encode('utf-8')).hexdigest()


def clear_client_buffer():
    frame_buffers.pop(verification_client_key(), None)


def _dhash_64(frame_bgr):
    # Difference hash for quick near-duplicate detection. Returns 64-bit int.
    gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
    small = cv2.resize(gray, (9, 8), interpolation=cv2.INTER_AREA)
    diff = small[:, 1:] > small[:, :-1]
    bits = diff.flatten().astype(np.uint8)
    value = 0
    for bit in bits:
        value = (value << 1) | int(bit)
    return int(value)


def should_log_intruder(client_key, frame_bgr, embedding):
    now = time.time()

    last_client_log = recent_intruder_per_client.get(client_key)
    if last_client_log is not None and (now - last_client_log) < DUPLICATE_INTRUDER_MIN_INTERVAL_PER_CLIENT:
        return False

    while recent_intruder_events and (now - recent_intruder_events[0]["timestamp"]) > INTRUDER_LOG_COOLDOWN_SECONDS:
        recent_intruder_events.popleft()

    for event in recent_intruder_events:
        similarity = float(np.dot(embedding, event["embedding"]) / ((np.linalg.norm(embedding) * np.linalg.norm(event["embedding"])) + 1e-8))
        if similarity >= INTRUDER_EMBEDDING_SIMILARITY:
            return False

    while recent_intruder_phashes and (now - recent_intruder_phashes[0]["timestamp"]) > INTRUDER_PHASH_WINDOW_SECONDS:
        recent_intruder_phashes.popleft()

    ph = _dhash_64(frame_bgr)
    for item in recent_intruder_phashes:
        if item["phash"] == ph:
            return False

    recent_intruder_events.append({
        "timestamp": now,
        "embedding": embedding.copy()
    })
    recent_intruder_phashes.append({
        "timestamp": now,
        "phash": ph
    })
    recent_intruder_per_client[client_key] = now
    return True


def has_duplicate_grace(voter_id):
    now = time.time()
    expires_at = recent_authorized_voters.get(voter_id)
    if expires_at is None:
        return False
    if now <= expires_at:
        return True
    recent_authorized_voters.pop(voter_id, None)
    return False


def mark_authorized(voter_id):
    recent_authorized_voters[voter_id] = time.time() + DUPLICATE_GRACE_SECONDS


def find_voter_by_identity(db, identity_label):
    normalized_name = normalize_identity_label(identity_label)

    return db.execute(
        '''
        SELECT *
        FROM voters
        WHERE voter_id = ?
           OR name = ?
           OR REPLACE(name, ' ', '_') = ?
        LIMIT 1
        ''',
        (identity_label, normalized_name, identity_label)
    ).fetchone()


def recognition_source_name():
    return "voter_embeddings"


def _load_voter_embeddings(db):
    global _db_embedding_cache, _db_embedding_cache_key

    key_row = db.execute(
        "SELECT COALESCE(MAX(id), 0) AS max_id, COUNT(*) AS cnt FROM voter_embeddings"
    ).fetchone()
    cache_key = (
        f"{int(key_row['max_id'])}:{int(key_row['cnt'])}"
        if key_row
        else "0:0"
    )

    if _db_embedding_cache is not None and _db_embedding_cache_key == cache_key:
        return _db_embedding_cache

    rows = db.execute(
        '''
        SELECT v.id AS voter_db_id, v.voter_id, v.name, e.embedding_json
        FROM voter_embeddings e
        JOIN voters v ON v.id = e.voter_db_id
        ORDER BY v.id ASC, e.id ASC
        '''
    ).fetchall()

    parsed = {}
    for row in rows:
        voter_id = row["voter_id"]
        name = row["name"]
        try:
            emb = np.array(json.loads(row["embedding_json"]), dtype=np.float32)
        except Exception:
            continue
        emb = l2_normalize(emb)
        if voter_id not in parsed:
            parsed[voter_id] = {"name": name, "samples": []}
        parsed[voter_id]["samples"].append(emb)

    # Add mean vector per voter (useful when some samples are noisy).
    for voter_id, item in parsed.items():
        if item["samples"]:
            item["mean"] = l2_normalize(np.mean(np.stack(item["samples"], axis=0), axis=0))
        else:
            item["mean"] = None

    _db_embedding_cache = parsed
    _db_embedding_cache_key = cache_key
    return parsed


def _cosine_similarity(a, b):
    return float(np.dot(a, b) / ((np.linalg.norm(a) * np.linalg.norm(b)) + 1e-8))


def _compare_against_db(query_embedding, voter_db):
    if not voter_db:
        return None, -1.0, None, []

    results = []

    for voter_id, data in voter_db.items():
        samples = data.get("samples") or []
        mean = data.get("mean")
        sample_scores = [_cosine_similarity(query_embedding, s) for s in samples]
        top_sample = max(sample_scores) if sample_scores else -1.0
        mean_score = _cosine_similarity(query_embedding, mean) if mean is not None else -1.0
        score = max(top_sample, mean_score)

        results.append({
            "voter_id": voter_id,
            "name": data.get("name") or voter_id,
            "score": float(score),
            "mean_score": float(mean_score),
            "top_sample_score": float(top_sample),
        })

    results.sort(key=lambda item: item["score"], reverse=True)
    best = results[0]
    second_score = results[1]["score"] if len(results) > 1 else -1.0

    strong_accept = (best["score"] >= STRONG_ACCEPT_SCORE and best["mean_score"] >= STRONG_ACCEPT_MEAN)
    low_confidence = (best["score"] < MATCH_THRESHOLD or best["mean_score"] < PERSON_MEAN_THRESHOLD)
    low_margin = second_score >= 0 and (best["score"] - second_score) < TOP_MATCH_MARGIN

    if low_confidence and not strong_accept:
        return UNKNOWN_LABEL, best["score"], None, results[:3]

    if low_margin and not strong_accept:
        return UNCERTAIN_LABEL, best["score"], None, results[:3]

    return best["voter_id"], best["score"], best["name"], results[:3]


@verify_bp.route('/verify', methods=['POST'])
@token_required
def verify():
    data = request.get_json()
    base64_image = data.get('image')

    if not base64_image:
        return jsonify({'status': 'error', 'message': 'No image received', 'confidence': 0}), 400

    frame = decode_base64_image(base64_image)
    if frame is None:
        return jsonify({'status': 'error', 'message': 'Could not decode image', 'confidence': 0}), 400

    result = detect_face(frame)
    if result is None:
        clear_client_buffer()
        return jsonify({
            'status': 'no_face',
            'message': 'No face detected. Please face the camera directly.',
            'confidence': 0
        }), 200

    pil_face = result[0]
    query_embedding = l2_normalize(get_embedding(pil_face))

    client_key = verification_client_key()

    # If a new person steps in front of the camera, don't keep averaging the
    # previous person's embeddings (which can cause "duplicate" on an intruder).
    existing = frame_buffers.get(client_key)
    if existing and len(existing) > 0:
        last_emb = existing[-1]
        if _cosine_similarity(query_embedding, last_emb) < EMBEDDING_FACE_CHANGE_THRESHOLD:
            frame_buffers[client_key].clear()

    frame_buffers[client_key].append(query_embedding)

    if len(frame_buffers[client_key]) < FRAME_BUFFER_SIZE:
        progress = len(frame_buffers[client_key])
        return jsonify({
            'status': 'scanning',
            'message': f'Collecting stable face samples ({progress}/{FRAME_BUFFER_SIZE})',
            'confidence': 0
        }), 200

    avg_emb = l2_normalize(np.mean(np.stack(frame_buffers[client_key]), axis=0))
    db = get_db()
    voter_db = _load_voter_embeddings(db)
    matched_identity, score, matched_name, top_matches = _compare_against_db(avg_emb, voter_db)
    print(f"Verification best match: {matched_identity}, score={score:.4f}, source={recognition_source_name()}")
    confidence = round(max(score, 0.0) * 100, 2)

    if matched_identity and matched_identity not in {UNKNOWN_LABEL, UNCERTAIN_LABEL} and score >= MATCH_THRESHOLD:
        # Identity label is the voter_id (generated during registration).
        voter = find_voter_by_identity(db, matched_identity)
        display_name = voter["name"] if voter else (matched_name or normalize_identity_label(matched_identity))

        if voter and voter['has_voted']:
            if has_duplicate_grace(voter['voter_id']):
                clear_client_buffer()
                return jsonify({
                    'status': 'authorized',
                    'name': display_name,
                    'message': 'Identity Verified - Vote session still active',
                    'confidence': confidence,
                    'identity_key': matched_identity,
                    'source': recognition_source_name()
                }), 200
            clear_client_buffer()
            return jsonify({
                    'status': 'duplicate',
                    'name': display_name,
                    'message': 'Already Voted - Duplicate Detected',
                    'confidence': confidence,
                    'identity_key': matched_identity,
                    'source': recognition_source_name()
            }), 200

        if voter:
            db.execute('UPDATE voters SET has_voted = 1 WHERE id = ?', (voter['id'],))
            db.commit()
            mark_authorized(voter['voter_id'])
            message = 'Identity Verified - Proceed to Vote'
        else:
            message = 'Identity matched in embeddings, but voter record was not found'

        clear_client_buffer()
        return jsonify({
            'status': 'authorized',
            'name': display_name,
            'message': message,
            'confidence': confidence,
            'identity_key': matched_identity,
            'source': recognition_source_name()
        }), 200

    if matched_identity == UNCERTAIN_LABEL:
        # Keep collecting; don't clear buffer here.
        return jsonify({
            'status': 'uncertain',
            'name': '',
            'message': (
                f'High similarity ({confidence}%) but another identity is too close. '
                'Please face the camera clearly and hold still.'
            ),
            'confidence': confidence,
            'source': recognition_source_name()
        }), 200

    image_path = None
    message = f'Access Denied - Score {confidence}% below threshold'

    if should_log_intruder(client_key, frame, avg_emb):
        timestamp_str = datetime.now().strftime('%Y%m%d_%H%M%S')
        image_filename = f"intruder_{timestamp_str}.jpg"
        image_save_path = os.path.join(
            current_app.config['INTRUDER_CAPTURES_FOLDER'],
            image_filename
        )
        cv2.imwrite(image_save_path, frame)
        image_path = f"intruder_captures/{image_filename}"

        db.execute(
            '''
            INSERT INTO intruders (image_path, location, confidence)
            VALUES (?, ?, ?)
            ''',
            (image_path, 'Polling Station A', confidence)
        )
        db.commit()
    else:
        message = f'Repeated intruder attempt suppressed - Score {confidence}% below threshold'

    clear_client_buffer()
    return jsonify({
        'status': 'intruder',
        'name': 'Intruder',
        'message': message,
        'confidence': confidence,
        'image_path': image_path,
        'source': recognition_source_name()
    }), 200
