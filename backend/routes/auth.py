# routes/auth.py — Login endpoint

from flask import Blueprint, request, jsonify, current_app
from database.db import get_db
import hashlib
import jwt
import datetime

auth_bp = Blueprint('auth', __name__)

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def generate_token(user_id, username):
    payload = {
        'user_id': user_id,
        'username': username,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=8)
    }
    return jwt.encode(payload, current_app.config['SECRET_KEY'], algorithm='HS256')

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '')

    if not username or not password:
        return jsonify({'message': 'Username and password required'}), 400

    db = get_db()
    user = db.execute(
        'SELECT * FROM users WHERE username = ?', (username,)
    ).fetchone()

    if not user or user['password_hash'] != hash_password(password):
        return jsonify({'message': 'Invalid username or password'}), 401

    token = generate_token(user['id'], user['username'])
    return jsonify({'token': token, 'username': username}), 200
