# routes/intruders.py — Intruder log endpoints

from flask import Blueprint, jsonify
from database.db import get_db
from middleware import token_required

intruders_bp = Blueprint('intruders', __name__)

@intruders_bp.route('', methods=['GET'])
@token_required
def get_intruders():
    db = get_db()
    rows = db.execute('''
        SELECT id, image_path, timestamp, location, confidence
        FROM intruders ORDER BY timestamp DESC
    ''').fetchall()

    intruders = [{
        'id': row['id'],
        'image_path': row['image_path'],
        'timestamp': row['timestamp'],
        'location': row['location'] or 'Polling Station A',
        'confidence': row['confidence']
    } for row in rows]

    return jsonify(intruders), 200
