"""
AETHER OS — Supabase Client Helpers
Shared database functions for the ML pipeline scripts.
"""
import os
from supabase import create_client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")

_client = None

def get_client():
    """Get or create Supabase client (singleton)."""
    global _client
    if _client is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise EnvironmentError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
        _client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _client


def get_recent_events(limit=500):
    """Pull recent events from Supabase events table."""
    client = get_client()
    result = client.table("events") \
        .select("*") \
        .order("created_at", desc=True) \
        .limit(limit) \
        .execute()
    return result.data or []


def upsert_state(state_row: dict):
    """Upsert a daily state record into the daily_state table."""
    client = get_client()
    result = client.table("daily_state") \
        .upsert(state_row, on_conflict="date") \
        .execute()
    return result


def insert_insight(insight: dict):
    """Insert an insight record."""
    client = get_client()
    result = client.table("insights") \
        .insert(insight) \
        .execute()
    return result