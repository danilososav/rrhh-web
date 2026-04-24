"""
Dashboard data cache backed by Supabase (postgres).
Falls back to in-memory dict if SUPABASE_URL / SUPABASE_KEY are not set.

Supabase table required (run once in the SQL editor):

    CREATE TABLE IF NOT EXISTS dashboard_cache (
        username TEXT NOT NULL,
        module   TEXT NOT NULL,
        data     JSONB,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (username, module)
    );
"""
from __future__ import annotations

import os
from typing import Any

# ── In-memory fallback (used when Supabase env vars are absent) ───────────────
_mem: dict[str, dict[str, Any]] = {}


def _get_client():
    """Return a Supabase client, or None if env vars are missing."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    if not url or not key:
        return None
    from supabase import create_client
    return create_client(url, key)


def save(username: str, module: str, data: Any) -> None:
    client = _get_client()
    if client is None:
        _mem.setdefault(username, {})[module] = data
        return
    client.table("dashboard_cache").upsert(
        {"username": username, "module": module, "data": data},
        on_conflict="username,module",
    ).execute()


def load(username: str, module: str) -> Any | None:
    client = _get_client()
    if client is None:
        return _mem.get(username, {}).get(module)
    result = (
        client.table("dashboard_cache")
        .select("data")
        .eq("username", username)
        .eq("module", module)
        .execute()
    )
    if result.data:
        return result.data[0]["data"]
    return None
