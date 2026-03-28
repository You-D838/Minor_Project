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
        # Ensure ON DELETE CASCADE works for voter_embeddings.
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db

def close_db(e=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()

def init_db():
    from flask import current_app
    db = sqlite3.connect(DATABASE)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")

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
            citizenship_no TEXT,
            phone TEXT,
            address TEXT,
            photo_path TEXT,
            has_voted INTEGER DEFAULT 0,
            registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Add citizenship_no if upgrading an existing DB created before this column existed.
    cols = [row[1] for row in db.execute("PRAGMA table_info(voters)").fetchall()]
    if "citizenship_no" not in cols:
        db.execute("ALTER TABLE voters ADD COLUMN citizenship_no TEXT")

    # Enforce "register once" on citizenship number (NULLs allowed for legacy/dummy rows).
    db.execute('''
        CREATE UNIQUE INDEX IF NOT EXISTS idx_voters_citizenship_no
        ON voters (citizenship_no)
        WHERE citizenship_no IS NOT NULL
    ''')

    db.execute('''
        CREATE TABLE IF NOT EXISTS voter_embeddings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            voter_db_id INTEGER NOT NULL,
            embedding_json TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (voter_db_id) REFERENCES voters (id) ON DELETE CASCADE
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
