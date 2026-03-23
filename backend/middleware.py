# middleware.py — JWT token verification

from flask import request, jsonify
from functools import wraps
import jwt
import os

SECRET_KEY = 'electoral-secret-key-change-in-production'

def token_required(f):
    """
    Decorator to protect routes.
    Add @token_required above any route that needs authentication.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None

        # Get token from Authorization header
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]

        if not token:
            return jsonify({'message': 'Token is missing'}), 401

        # Allow demo token during development
        if token == 'demo-token':
            return f(*args, **kwargs)

        try:
            jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired. Please login again.'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Invalid token'}), 401

        return f(*args, **kwargs)

    return decorated
