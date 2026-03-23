# app.py — Main Flask application

import pathlib
pathlib.PosixPath = pathlib.WindowsPath  # Windows YOLO fix

from flask import Flask, send_from_directory
from flask_cors import CORS
from database.db import init_db
from routes.auth import auth_bp
from routes.voters import voters_bp
from routes.verify import verify_bp
from routes.intruders import intruders_bp
from routes.stats import stats_bp
import os

app = Flask(__name__)

# CORS fix — allow React frontend on port 3000
CORS(app, resources={
    r"/api/*": {
        "origins": "http://localhost:3000",
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    return response

# Config
app.config['SECRET_KEY'] = 'electoral-secret-key-change-in-production'
app.config['VOTER_PHOTOS_FOLDER'] = 'voter_photos'
app.config['INTRUDER_CAPTURES_FOLDER'] = 'static/intruder_captures'
app.config['CROPPED_FACES_FOLDER'] = 'cropped_faces'

# Create required folders
os.makedirs(app.config['VOTER_PHOTOS_FOLDER'], exist_ok=True)
os.makedirs(app.config['INTRUDER_CAPTURES_FOLDER'], exist_ok=True)
os.makedirs(app.config['CROPPED_FACES_FOLDER'], exist_ok=True)

# Serve voter photos statically
@app.route('/voter_photos/<filename>')
def serve_voter_photo(filename):
    return send_from_directory(app.config['VOTER_PHOTOS_FOLDER'], filename)

# Register all route blueprints
app.register_blueprint(auth_bp,      url_prefix='/api/auth')
app.register_blueprint(voters_bp,    url_prefix='/api/voters')
app.register_blueprint(verify_bp,    url_prefix='/api')
app.register_blueprint(intruders_bp, url_prefix='/api/intruders')
app.register_blueprint(stats_bp,     url_prefix='/api')

# Initialize database
with app.app_context():
    init_db()

if __name__ == '__main__':
    app.run(debug=True, port=5000)