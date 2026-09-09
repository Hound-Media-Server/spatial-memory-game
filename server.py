#!/usr/bin/env python3

import base64
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

HOST = "0.0.0.0"
PORT = int(os.environ.get("PORT", 1212))

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("DATA_DIR", BASE_DIR))
DB_PATH = DATA_DIR / "leaderboard.db"
INDEX_PATH = BASE_DIR / "index.html"

SECRET = os.environ.get(
    "SCORE_SECRET",
    "CHANGE-THIS-TO-A-LONG-RANDOM-SECRET"
).encode()

TOKEN_LIFETIME = 5 * 60
MAX_SCORE = 500
MAX_NAME_LENGTH = 32

RATE_LIMIT_WINDOW = 60
MAX_TOKEN_REQUESTS = 10
MAX_SCORE_SUBMISSIONS = 10

rate_limits = {}

# Database
def get_db():
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    return db


def init_db():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    db = get_db()
    db.execute("""
        CREATE TABLE IF NOT EXISTS leaderboard (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            score INTEGER NOT NULL,
            time INTEGER NOT NULL
        )
    """)

    db.execute("""
        CREATE INDEX IF NOT EXISTS idx_leaderboard_score
        ON leaderboard(score DESC)
    """)

    db.commit()
    db.close()


# Simple token system
def create_token():
    payload = {
        "iat": int(time.time()),
        "nonce": secrets.token_hex(16),
    }

    payload_bytes = json.dumps(
        payload,
        separators=(",", ":"),
        sort_keys=True
    ).encode()

    encoded = base64.urlsafe_b64encode(payload_bytes).decode().rstrip("=")
    signature = hmac.new(
        SECRET,
        encoded.encode(),
        hashlib.sha256
    ).hexdigest()

    return f"{encoded}.{signature}"


def validate_token(token):
    try:
        encoded, signature = token.split(".", 1)
        expected_signature = hmac.new(
            SECRET,
            encoded.encode(),
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(signature, expected_signature):
            return False

        padding = "=" * (-len(encoded) % 4)
        payload_bytes = base64.urlsafe_b64decode(
            encoded + padding
        )

        payload = json.loads(payload_bytes)
        issued_at = int(payload["iat"])
        if time.time() - issued_at > TOKEN_LIFETIME:
            return False
        if time.time() < issued_at:
            return False

        return True

    except Exception:
        return False


# Simple Rate-limiting
def check_rate_limit(ip, action, maximum):
    now = time.time()
    key = (ip, action)

    timestamps = rate_limits.get(key, [])

    timestamps = [
        timestamp
        for timestamp in timestamps
        if now - timestamp < RATE_LIMIT_WINDOW
    ]

    if len(timestamps) >= maximum:
        rate_limits[key] = timestamps
        return False

    timestamps.append(now)
    rate_limits[key] = timestamps

    return True



class Handler(BaseHTTPRequestHandler):

    def send_json(self, status, data):
        body = json.dumps(data).encode()

        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

        self.wfile.write(body)

    def read_json(self):
        try:
            length = int(self.headers.get("Content-Length", 0))

            # Don't accept enormous requests.
            if length > 16 * 1024:
                return None

            body = self.rfile.read(length)

            return json.loads(body)

        except Exception:
            return None

    def client_ip(self):
        return self.client_address[0]

    # GET requests
    def do_GET(self):
        path = urlparse(self.path).path

        if path == "/api/leaderboard":
            self.get_leaderboard()
            return

        if path == "/api/score-token":
            self.get_score_token()
            return

        # Serve index.html
        if path == "/":
            self.serve_file(INDEX_PATH)
            return

        # Optional static files.
        # /style.css
        # /game.js
        # etc.
        requested = (BASE_DIR / path.lstrip("/")).resolve()

        # Prevent ../ traversal.
        if BASE_DIR not in requested.parents and requested != BASE_DIR:
            self.send_error(403)
            return

        if requested.is_file():
            self.serve_file(requested)
            return

        self.send_error(404)

    
    # POST requests
    def do_POST(self):
        path = urlparse(self.path).path

        if path == "/api/leaderboard":
            self.submit_score()
            return

        self.send_error(404)

    def get_score_token(self):
        ip = self.client_ip()

        if not check_rate_limit(
            ip,
            "token",
            MAX_TOKEN_REQUESTS
        ):
            self.send_json(429, {
                "error": "Too many requests"
            })
            return

        token = create_token()

        self.send_json(200, {
            "token": token,
            "expires_in": TOKEN_LIFETIME
        })

    def get_leaderboard(self):
        try:
            limit = int(
                urlparse(self.path).query.split("limit=")[-1]
                if "limit=" in self.path
                else 100
            )
        except ValueError:
            limit = 100

        limit = max(1, min(limit, 100))

        db = get_db()

        rows = db.execute("""
            SELECT
                name,
                score,
                time
            FROM leaderboard
            ORDER BY score DESC, time ASC
            LIMIT ?
        """, (limit,)).fetchall()

        db.close()

        self.send_json(200, {
            "scores": [
                {
                    "name": row["name"],
                    "score": row["score"],
                    "time": row["time"]
                }
                for row in rows
            ]
        })

    # Submit score
    def submit_score(self):
        ip = self.client_ip()

        if not check_rate_limit(
            ip,
            "score",
            MAX_SCORE_SUBMISSIONS
        ):
            self.send_json(429, {
                "error": "Too many submissions"
            })
            return

        data = self.read_json()

        if not isinstance(data, dict):
            self.send_json(400, {
                "error": "Invalid JSON"
            })
            return

        token = data.get("token")
        name = data.get("name")
        score = data.get("score")

        if not isinstance(token, str) or not validate_token(token):
            self.send_json(403, {
                "error": "Invalid or expired token"
            })
            return

        if not isinstance(name, str):
            self.send_json(400, {
                "error": "Invalid name"
            })
            return

        name = name.strip()

        if not name:
            self.send_json(400, {
                "error": "Name cannot be empty"
            })
            return

        if len(name) > MAX_NAME_LENGTH:
            self.send_json(400, {
                "error": "Name is too long"
            })
            return

        if isinstance(score, bool) or not isinstance(score, int):
            self.send_json(400, {
                "error": "Invalid score"
            })
            return

        if score < 0 or score > MAX_SCORE:
            self.send_json(400, {
                "error": "Score is out of range"
            })
            return

        submitted_at = int(time.time())

        db = get_db()

        db.execute("""
            INSERT INTO leaderboard
                (name, score, time)
            VALUES
                (?, ?, ?)
        """, (
            name,
            score,
            submitted_at
        ))

        db.commit()
        db.close()

        self.send_json(200, {
            "success": True
        })

    def serve_file(self, path):
        try:
            data = path.read_bytes()
        except Exception:
            self.send_error(404)
            return

        content_type = {
            ".html": "text/html; charset=utf-8",
            ".js": "text/javascript; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".mp3": "audio/mpeg",
            ".svg": "image/svg+xml",
            ".ico": "image/x-icon",
        }.get(path.suffix.lower(), "application/octet-stream")

        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()

        self.wfile.write(data)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def log_message(self, format, *args):
        print(
            f"[{self.address_string()}] {format % args}"
        )

if __name__ == "__main__":
    init_db()

    print(f"Database: {DB_PATH}")
    print(f"Serving:  http://localhost:{PORT}")
    print("Press Ctrl+C to stop.")

    server = ThreadingHTTPServer(
        (HOST, PORT),
        Handler
    )

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping...")
    finally:
        server.server_close()