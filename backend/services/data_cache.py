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

import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

_mem: dict[str, dict[str, Any]] = {}
_client = None


def _get_client():
    global _client
    if _client is not None:
        return _client
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_KEY", "").strip()
    if not url or not key:
        logger.warning("SUPABASE_URL/SUPABASE_KEY not set — using in-memory cache")
        return None
    try:
        from supabase import create_client
        _client = create_client(url, key)
        logger.info("Supabase client initialized: %s", url)
        return _client
    except Exception as exc:
        logger.error("Failed to create Supabase client: %s", exc)
        return None


def save(username: str, module: str, data: Any) -> None:
    client = _get_client()
    if client is None:
        _mem.setdefault(username, {})[module] = data
        return
    client.table("dashboard_cache").upsert(
        {"username": username, "module": module, "data": data}
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
