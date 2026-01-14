"""Utility functions for the application."""
from datetime import datetime, timezone


def utc_now() -> datetime:
    """
    Return the current UTC time as a naive datetime.

    This replaces datetime.utcnow() which is deprecated in Python 3.12+.
    Returns naive datetime (no tzinfo) for compatibility with PostgreSQL
    TIMESTAMP WITHOUT TIME ZONE columns.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)
