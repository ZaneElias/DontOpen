"""
Supabase JWT verification.

This project's Supabase instance signs with asymmetric JWT signing keys, so
there is no legacy shared HS256 secret to compare against. Tokens are verified
against the project's JWKS endpoint (ES256/RS256), with the public keys fetched
once and cached by PyJWKClient.

Any request that touches job/quote data must carry a valid bearer token; see
the auth middleware in main.py for which paths are enforced.
"""

from __future__ import annotations

import logging
import os
from typing import Optional

import jwt
from jwt import PyJWKClient

logger = logging.getLogger("callpilot.auth")

def _resolve_jwks_url() -> str:
    """JWKS endpoint, derived from SUPABASE_URL when not given explicitly.

    Two env vars for one fact is an easy way to half-configure a deploy and get
    a confusing 503, so SUPABASE_URL alone is enough.
    """
    explicit = os.environ.get("SUPABASE_JWKS_URL", "").strip()
    if explicit:
        return explicit
    base = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
    return f"{base}/auth/v1/.well-known/jwks.json" if base else ""


SUPABASE_JWKS_URL = _resolve_jwks_url()
# Supabase mints access tokens with this audience for signed-in users.
_EXPECTED_AUDIENCE = "authenticated"
_ALGORITHMS = ["ES256", "RS256"]

_jwk_client: Optional[PyJWKClient] = None


class AuthError(Exception):
    """Raised when a bearer token is missing, malformed, or fails verification."""


def auth_configured() -> bool:
    return bool(SUPABASE_JWKS_URL)


def _client() -> PyJWKClient:
    global _jwk_client
    if _jwk_client is None:
        if not SUPABASE_JWKS_URL:
            raise AuthError("Supabase auth is not configured (SUPABASE_JWKS_URL unset)")
        # cache_keys avoids refetching JWKS on every request.
        _jwk_client = PyJWKClient(SUPABASE_JWKS_URL, cache_keys=True)
    return _jwk_client


def verify_token(token: str) -> dict:
    """Verify a Supabase access token and return its claims. Raises AuthError."""
    if not token:
        raise AuthError("missing token")
    try:
        signing_key = _client().get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=_ALGORITHMS,
            audience=_EXPECTED_AUDIENCE,
            options={"verify_exp": True},
        )
    except AuthError:
        raise
    except Exception as exc:  # invalid signature, expired, malformed, JWKS fetch failure
        raise AuthError(str(exc)) from exc


def user_id_from_header(authorization: Optional[str]) -> str:
    """Extract and verify a bearer token, returning the Supabase user id (sub)."""
    return credentials_from_header(authorization)[0]


def credentials_from_header(authorization: Optional[str]) -> tuple[str, str]:
    """Verify the bearer token; return (user_id, raw_token).

    The raw token is passed to the Supabase store so queries run AS the user and
    RLS enforces ownership in the database rather than in application code.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise AuthError("missing bearer token")
    token = authorization[7:].strip()
    claims = verify_token(token)
    sub = claims.get("sub")
    if not sub:
        raise AuthError("token has no subject")
    return sub, token
