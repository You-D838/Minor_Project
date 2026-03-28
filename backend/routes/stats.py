# routes/stats.py — Dashboard statistics

import sqlite3

from flask import Blueprint, jsonify
from database.db import get_db, init_db
from middleware import token_required

stats_bp = Blueprint('stats', __name__)

@stats_bp.route('/stats', methods=['GET'])
@token_required
def get_stats():
    db = get_db()

    try:
        total_voters = db.execute('SELECT COUNT(*) FROM voters').fetchone()[0]
        voted        = db.execute('SELECT COUNT(*) FROM voters WHERE has_voted = 1').fetchone()[0]
        not_voted    = total_voters - voted
        intruders    = db.execute('SELECT COUNT(*) FROM intruders').fetchone()[0]
    except sqlite3.OperationalError:
        # Rare debug startup/reload edge-case: ensure schema exists then retry once.
        init_db()
        total_voters = db.execute('SELECT COUNT(*) FROM voters').fetchone()[0]
        voted        = db.execute('SELECT COUNT(*) FROM voters WHERE has_voted = 1').fetchone()[0]
        not_voted    = total_voters - voted
        intruders    = db.execute('SELECT COUNT(*) FROM intruders').fetchone()[0]

    return jsonify({
        'total_voters': total_voters,
        'voted': voted,
        'not_voted': not_voted,
        'intruders': intruders
    }), 200
