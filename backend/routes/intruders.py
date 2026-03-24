# routes/intruders.py — Intruder log endpoints

from flask import Blueprint, jsonify, current_app
from database.db import get_db
from middleware import token_required
import os

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


@intruders_bp.route('/<int:intruder_id>', methods=['DELETE'])
@token_required
def delete_intruder(intruder_id):
    db = get_db()
    intruder = db.execute(
        'SELECT id, image_path FROM intruders WHERE id = ?',
        (intruder_id,)
    ).fetchone()

    if not intruder:
        return jsonify({'message': 'Intruder log not found'}), 404

    db.execute('DELETE FROM intruders WHERE id = ?', (intruder_id,))
    db.commit()

    if intruder['image_path']:
        image_path = os.path.join(current_app.static_folder, intruder['image_path'])
        if os.path.exists(image_path):
            try:
                os.remove(image_path)
            except OSError:
                pass

    return jsonify({'message': 'Intruder log removed successfully'}), 200
