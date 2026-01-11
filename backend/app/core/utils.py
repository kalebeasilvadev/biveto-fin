"""Utility functions for the application."""
from datetime import datetime, timezone


def utc_now() -> datetime:
    """
    Return the current UTC time as a timezone-aware datetime.

    This replaces datetime.utcnow() which returns a naive datetime
    and is deprecated in Python 3.12+.
    """
    return datetime.now(timezone.utc)
