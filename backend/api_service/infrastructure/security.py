"""Password hashing and signed bearer tokens (standard library only).

Tokens are JWT-shaped (`header.payload.signature`) but deliberately minimal.
The `SECRET_KEY` setting signs them; no database is involved.
"""
import base64
import hashlib
import hmac
import json
import secrets
import time
from typing import Any, Dict, Optional, Set

from api_service.domain.entities import Role, User
from api_service.domain.errors import UnauthorizedError

ITERATIONS = 120_000


def _b64e(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64d(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


class PasswordHasher:
    @staticmethod
    def hash(password: str) -> str:
        salt = secrets.token_bytes(16)
        digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, ITERATIONS)
        return f"pbkdf2_sha256${ITERATIONS}${_b64e(salt)}${_b64e(digest)}"

    @staticmethod
    def verify(password: str, encoded: str) -> bool:
        try:
            algorithm, iterations, salt, expected = encoded.split("$", 3)
            if algorithm != "pbkdf2_sha256":
                return False
            digest = hashlib.pbkdf2_hmac(
                "sha256", password.encode("utf-8"), _b64d(salt), int(iterations)
            )
            return hmac.compare_digest(_b64e(digest), expected)
        except (ValueError, TypeError):
            return False


class TokenProvider:
    """Issues, verifies and rotates access/refresh tokens."""

    def __init__(self, secret: str, access_ttl: int, refresh_ttl: int):
        self._secret = secret.encode("utf-8")
        self._access_ttl = access_ttl
        self._refresh_ttl = refresh_ttl
        self._used_refresh_ids: Set[str] = set()

    def _sign(self, payload: Dict[str, Any]) -> str:
        header = _b64e(b'{"alg":"HS256","typ":"JWT"}')
        body = _b64e(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
        signing_input = f"{header}.{body}".encode("ascii")
        signature = _b64e(hmac.new(self._secret, signing_input, hashlib.sha256).digest())
        return f"{header}.{body}.{signature}"

    def issue(self, user: User) -> Dict[str, Any]:
        now = int(time.time())
        access = self._sign(
            {
                "sub": user.id,
                "role": user.role,
                "type": "access",
                "iat": now,
                "exp": now + self._access_ttl,
                "jti": secrets.token_hex(8),
            }
        )
        refresh = self._sign(
            {
                "sub": user.id,
                "role": user.role,
                "type": "refresh",
                "iat": now,
                "exp": now + self._refresh_ttl,
                "jti": secrets.token_hex(8),
            }
        )
        return {
            "access_token": access,
            "refresh_token": refresh,
            "token_type": "Bearer",
            "expires_in": self._access_ttl,
            "user": user.public(),
        }

    def decode(self, token: str, expected_type: str = "access") -> Dict[str, Any]:
        try:
            header, body, signature = token.split(".")
            signing_input = f"{header}.{body}".encode("ascii")
            expected = hmac.new(self._secret, signing_input, hashlib.sha256).digest()
            if not hmac.compare_digest(_b64d(signature), expected):
                raise UnauthorizedError("Invalid token signature")
            payload = json.loads(_b64d(body).decode("utf-8"))
        except (ValueError, UnicodeDecodeError, json.JSONDecodeError):
            raise UnauthorizedError("Malformed token")

        if payload.get("type") != expected_type:
            raise UnauthorizedError("Wrong token type")
        if payload.get("exp", 0) < int(time.time()):
            raise UnauthorizedError("Token has expired")
        if expected_type == "refresh" and payload.get("jti") in self._used_refresh_ids:
            raise UnauthorizedError("Refresh token has already been rotated")
        return payload

    def rotate(self, refresh_token: str) -> Dict[str, Any]:
        claims = self.decode(refresh_token, "refresh")
        self._used_refresh_ids.add(claims["jti"])
        now = int(time.time())
        access = self._sign(
            {
                "sub": claims["sub"],
                "role": claims["role"],
                "type": "access",
                "iat": now,
                "exp": now + self._access_ttl,
                "jti": secrets.token_hex(8),
            }
        )
        refresh = self._sign(
            {
                "sub": claims["sub"],
                "role": claims["role"],
                "type": "refresh",
                "iat": now,
                "exp": now + self._refresh_ttl,
                "jti": secrets.token_hex(8),
            }
        )
        return {
            "access_token": access,
            "refresh_token": refresh,
            "token_type": "Bearer",
            "expires_in": self._access_ttl,
        }


def role_is(user: User, *roles: str) -> bool:
    return user.role in roles or user.role == Role.ADMIN
