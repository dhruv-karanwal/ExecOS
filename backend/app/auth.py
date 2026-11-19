"""Local application accounts and expiring workbench sessions."""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import time
from threading import RLock
from typing import Any


class AccountError(ValueError):
    """Raised when application credentials or account operations are invalid."""


class AccountManager:
    """SQLite-backed accounts with salted hashes and in-memory expiring sessions."""

    ITERATIONS = 310_000
    SESSION_TTL_SECONDS = 8 * 60 * 60

    def __init__(self, database_path: str | None = None) -> None:
        self._lock = RLock()
        self._sessions: dict[str, tuple[str, float]] = {}
        path = database_path or os.environ.get(
            "EXECOS_AUTH_DB_PATH",
            os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "accounts.sqlite3"),
        )
        if path != ":memory:":
            os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        self._database = sqlite3.connect(path, check_same_thread=False)
        self._database.row_factory = sqlite3.Row
        self._database.execute(
            """
            CREATE TABLE IF NOT EXISTS accounts (
                username TEXT PRIMARY KEY,
                email TEXT UNIQUE,
                full_name TEXT NOT NULL DEFAULT '',
                role TEXT NOT NULL,
                group_name TEXT NOT NULL DEFAULT 'users',
                salt BLOB NOT NULL,
                password_hash BLOB NOT NULL,
                created_at REAL NOT NULL
            )
            """
        )
        self._database.execute(
            """
            CREATE TABLE IF NOT EXISTS learning_progress (
                username TEXT PRIMARY KEY REFERENCES accounts(username) ON DELETE CASCADE,
                progress_json TEXT NOT NULL,
                updated_at REAL NOT NULL
            )
            """
        )
        self._database.commit()

    @staticmethod
    def _username(value: str) -> str:
        username = value.strip().lower()
        if not re.fullmatch(r"[a-z0-9_-]{3,32}", username):
            raise AccountError(
                "Username must be 3–32 characters using letters, numbers, _ or -"
            )
        return username

    def register(
        self,
        username: str | None,
        password: str,
        email: str | None = None,
        full_name: str | None = None,
    ) -> dict[str, Any]:
        with self._lock:
            if len(password) < 10:
                raise AccountError("Password must be at least 10 characters")
            normalized_email = self._email(email) if email else None
            if normalized_email and self._database.execute(
                "SELECT 1 FROM accounts WHERE email = ?", (normalized_email,)
            ).fetchone():
                raise AccountError("Email address is already registered")
            if username:
                name = self._username(username)
            elif normalized_email:
                name = self._available_username(normalized_email.split("@", 1)[0])
            else:
                raise AccountError("An email address or username is required")
            if self._database.execute(
                "SELECT 1 FROM accounts WHERE username = ?", (name,)
            ).fetchone():
                raise AccountError("Username is already registered")
            salt = secrets.token_bytes(16)
            password_hash = hashlib.pbkdf2_hmac(
                "sha256", password.encode("utf-8"), salt, self.ITERATIONS
            )
            existing_accounts = self._database.execute(
                "SELECT COUNT(*) FROM accounts"
            ).fetchone()[0]
            role = "admin" if existing_accounts == 0 else "user"
            cleaned_name = (full_name or "").strip()[:100]
            if normalized_email and not cleaned_name:
                raise AccountError("Full name is required")
            user = {
                "username": name,
                "email": normalized_email or "",
                "full_name": cleaned_name,
                "role": role,
                "group": "users",
            }
            self._database.execute(
                """
                INSERT INTO accounts
                    (username, email, full_name, role, group_name, salt, password_hash, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    name,
                    normalized_email,
                    cleaned_name,
                    role,
                    "users",
                    salt,
                    password_hash,
                    time.time(),
                ),
            )
            self._database.commit()
            return user

    def login(self, username: str, password: str) -> tuple[str, dict[str, Any]]:
        identifier = username.strip().casefold()
        with self._lock:
            if "@" in identifier:
                account = self._database.execute(
                    "SELECT * FROM accounts WHERE email = ?", (identifier,)
                ).fetchone()
            else:
                name = self._username(identifier)
                account = self._database.execute(
                    "SELECT * FROM accounts WHERE username = ?", (name,)
                ).fetchone()
            if account is None:
                raise AccountError("Invalid username or password")
            candidate = hashlib.pbkdf2_hmac(
                "sha256", password.encode("utf-8"), account["salt"], self.ITERATIONS
            )
            if not hmac.compare_digest(candidate, account["password_hash"]):
                raise AccountError("Invalid username or password")
            token = secrets.token_urlsafe(32)
            token_key = hashlib.sha256(token.encode("ascii")).hexdigest()
            self._sessions[token_key] = (
                account["username"],
                time.monotonic() + self.SESSION_TTL_SECONDS,
            )
            return token, self.public_user(dict(account))

    @staticmethod
    def _email(value: str) -> str:
        email = value.strip().casefold()
        if len(email) > 254 or not re.fullmatch(
            r"[^@\s]+@[^@\s]+\.[^@\s]+",
            email,
        ):
            raise AccountError("Enter a valid email address")
        return email

    def _available_username(self, local_part: str) -> str:
        base = re.sub(r"[^a-z0-9_-]", "-", local_part.casefold()).strip("-_")
        base = (base or "user")[:25]
        if len(base) < 3:
            base = f"{base}-user"
        name = base
        suffix = 1
        while self._database.execute(
            "SELECT 1 FROM accounts WHERE username = ?", (name,)
        ).fetchone():
            name = f"{base[:27-len(str(suffix))]}-{suffix}"
            suffix += 1
        return name

    @staticmethod
    def public_user(account: dict[str, Any]) -> dict[str, str]:
        return {
            "username": account["username"],
            "role": account["role"],
            "group": account.get("group", account.get("group_name", "users")),
            "email": account.get("email") or "",
            "full_name": account.get("full_name") or "",
        }

    def authenticate(self, authorization: str | None) -> dict[str, str] | None:
        if not authorization or not authorization.startswith("Bearer "):
            return None
        token = authorization[7:].strip()
        if not token:
            return None
        token_key = hashlib.sha256(token.encode("ascii", errors="ignore")).hexdigest()
        with self._lock:
            session = self._sessions.get(token_key)
            if session is None:
                return None
            username, expires_at = session
            if expires_at <= time.monotonic():
                del self._sessions[token_key]
                return None
            account = self._database.execute(
                "SELECT * FROM accounts WHERE username = ?", (username,)
            ).fetchone()
            if account is None:
                self._sessions.pop(token_key, None)
                return None
            return self.public_user(dict(account))

    def logout(self, authorization: str | None) -> None:
        if authorization and authorization.startswith("Bearer "):
            token = authorization[7:].strip()
            token_key = hashlib.sha256(token.encode("ascii", errors="ignore")).hexdigest()
            with self._lock:
                self._sessions.pop(token_key, None)

    def get_learning_progress(self, username: str) -> dict[str, Any]:
        with self._lock:
            row = self._database.execute(
                "SELECT progress_json FROM learning_progress WHERE username = ?",
                (username,),
            ).fetchone()
            return json.loads(row["progress_json"]) if row else {}

    def update_learning_progress(
        self,
        username: str,
        topic: str,
        updates: dict[str, Any],
    ) -> dict[str, Any]:
        with self._lock:
            row = self._database.execute(
                "SELECT progress_json FROM learning_progress WHERE username = ?",
                (username,),
            ).fetchone()
            progress = json.loads(row["progress_json"]) if row else {}
            existing = progress.get(topic, {})
            merged = {
                "visualization_visited": bool(existing.get("visualization_visited"))
                or bool(updates.get("visualization_visited")),
                "lesson_visited": bool(existing.get("lesson_visited"))
                or bool(updates.get("lesson_visited")),
                "quiz_attempts": max(
                    int(existing.get("quiz_attempts", 0)),
                    int(updates.get("quiz_attempts", 0)),
                ),
                "quiz_best_score": max(
                    int(existing.get("quiz_best_score", 0)),
                    int(updates.get("quiz_best_score", 0)),
                ),
                "challenge_attempts": max(
                    int(existing.get("challenge_attempts", 0)),
                    int(updates.get("challenge_attempts", 0)),
                ),
                "challenge_best_score": max(
                    int(existing.get("challenge_best_score", 0)),
                    int(updates.get("challenge_best_score", 0)),
                ),
                "challenge_completed": bool(existing.get("challenge_completed"))
                or bool(updates.get("challenge_completed")),
            }
            progress[topic] = merged
            self._database.execute(
                """
                INSERT INTO learning_progress (username, progress_json, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(username) DO UPDATE SET
                    progress_json = excluded.progress_json,
                    updated_at = excluded.updated_at
                """,
                (username, json.dumps(progress, separators=(",", ":")), time.time()),
            )
            self._database.commit()
            return progress

    def close(self) -> None:
        with self._lock:
            self._database.close()
