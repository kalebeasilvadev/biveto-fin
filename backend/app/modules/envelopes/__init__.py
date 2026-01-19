"""
Envelope Budgeting Module.

Implements YNAB-style envelope budgeting with category-based
spending limits and daily allowances.
"""

from .routers.envelopes import router

__all__ = ["router"]
