# database/db.py — Database connection and table creation

import sqlite3
import os
from flask import g

# Using SQLite for simplicity — easy to swap to PostgreSQL/MySQL later
# To switch to PostgreSQL: replace get_db() with SQLAlchemy connection

DATABASE = 'electoral.db'

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(DATABASE, detect_types=sqlite3.PARSE_DECLTYPES)
        g.db.row_factory = sqlite3.Row  # return dict-like rows
    return g.db

def close_db(e=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()

def init_db():
    from flask import current_app
    db = sqlite3.connect(DATABASE)
    db.row_factory = sqlite3.Row

    db.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    db.execute('''
        CREATE TABLE IF NOT EXISTS voters (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            voter_id TEXT UNIQUE NOT NULL,
            phone TEXT,
            address TEXT,
            photo_path TEXT,
            has_voted INTEGER DEFAULT 0,
            registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    db.execute('''
        CREATE TABLE IF NOT EXISTS intruders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            image_path TEXT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            location TEXT DEFAULT 'Polling Station A',
            confidence REAL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Create default admin user (password: admin123)
    # bcrypt hash of 'admin123'
    import hashlib
    password_hash = hashlib.sha256('admin123'.encode()).hexdigest()
    db.execute('''
        INSERT OR IGNORE INTO users (username, password_hash)
        VALUES (?, ?)
    ''', ('admin', password_hash))

    db.commit()
    db.close()
    print("Database initialized.")
