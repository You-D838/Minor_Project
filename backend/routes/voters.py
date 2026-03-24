# routes/voters.py — Voter registration and listing

from flask import Blueprint, request, jsonify, current_app
from database.db import get_db
from models.recognizer import generate_voter_embedding, load_embeddings, save_embeddings
from middleware import token_required
import os

voters_bp = Blueprint('voters', __name__)

@voters_bp.route('/register', methods=['POST'])
@token_required
def register_voter():
    name     = request.form.get('name')
    voter_id = request.form.get('voter_id')
    phone    = request.form.get('phone')
    address  = request.form.get('address')
    photo    = request.files.get('photo')

    if not name or not voter_id or not photo:
        return jsonify({'message': 'Name, voter ID and photo are required'}), 400

    db = get_db()

    # Check duplicate voter ID
    existing = db.execute(
        'SELECT id FROM voters WHERE voter_id = ?', (voter_id,)
    ).fetchone()
    if existing:
        return jsonify({'message': 'Voter ID already registered'}), 409

    # Save photo
    photo_filename = f"{voter_id}_{photo.filename}"
    photo_path = os.path.join(
        current_app.config['VOTER_PHOTOS_FOLDER'], photo_filename
    )
    photo.save(photo_path)

    # Auto-generate face embedding (YOLO crop + FaceNet)
    embedding_success = generate_voter_embedding(voter_id, photo_path)
    if not embedding_success:
        os.remove(photo_path)  # clean up saved photo
        return jsonify({
            'message': 'No face detected in photo. Please upload a clear front-facing photo.'
        }), 400

    # Save voter to database
    db.execute('''
        INSERT INTO voters (name, voter_id, phone, address, photo_path)
        VALUES (?, ?, ?, ?, ?)
    ''', (name, voter_id, phone, address, photo_filename))
    db.commit()

    new_voter = db.execute(
        'SELECT id FROM voters WHERE voter_id = ?', (voter_id,)
    ).fetchone()

    return jsonify({
        'message': 'Voter registered successfully',
        'voter_id': voter_id,
        'id': new_voter['id']
    }), 201


@voters_bp.route('', methods=['GET'])
@token_required
def get_voters():
    db = get_db()
    rows = db.execute('''
        SELECT id, name, voter_id, phone, address, photo_path,
               has_voted, registered_at
        FROM voters ORDER BY registered_at DESC
    ''').fetchall()

    voters = [{
        'id': row['id'],
        'name': row['name'],
        'voter_id': row['voter_id'],
        'phone': row['phone'] or '',
        'address': row['address'] or '',
        'photo_url': row['photo_path'],
        'status': 'voted' if row['has_voted'] else 'not-voted',
        'registered_at': row['registered_at']
    } for row in rows]

    return jsonify(voters), 200


@voters_bp.route('/<int:voter_db_id>', methods=['DELETE'])
@token_required
def delete_voter(voter_db_id):
    db = get_db()
    voter = db.execute(
        'SELECT id, voter_id, photo_path FROM voters WHERE id = ?',
        (voter_db_id,)
    ).fetchone()

    if not voter:
        return jsonify({'message': 'Voter not found'}), 404

    db.execute('DELETE FROM voters WHERE id = ?', (voter_db_id,))
    db.commit()

    if voter['photo_path']:
        photo_path = os.path.join(
            current_app.config['VOTER_PHOTOS_FOLDER'],
            voter['photo_path']
        )
        if os.path.exists(photo_path):
            try:
                os.remove(photo_path)
            except OSError:
                pass

    embeddings = load_embeddings()
    if voter['voter_id'] in embeddings:
        del embeddings[voter['voter_id']]
        save_embeddings(embeddings)

    return jsonify({'message': 'Voter removed successfully'}), 200


@voters_bp.route('/recent', methods=['GET'])
@token_required
def get_recent():
    db = get_db()
    rows = db.execute('''
        SELECT id, name, registered_at, has_voted
        FROM voters ORDER BY registered_at DESC LIMIT 10
    ''').fetchall()

    recent = [{
        'id': row['id'],
        'name': row['name'],
        'time': row['registered_at'],
        'status': 'Authorized' if row['has_voted'] else 'Not Voted'
    } for row in rows]

    return jsonify(recent), 200
