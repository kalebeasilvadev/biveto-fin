"""
Grocery (Mercado) Module

Manages grocery shopping tracking, shopping lists, and price history.
"""
from .routers import router
from .schemas import (
    GroceryProductCreate,
    GroceryProductUpdate,
    GroceryProductResponse,
    GroceryPurchaseCreate,
    GroceryPurchaseBulkCreate,
    GroceryPurchaseUpdate,
    GroceryPurchaseResponse,
    GroceryPurchaseSummary,
    GroceryPurchaseComparison,
    ShoppingListCreate,
    ShoppingListUpdate,
    ShoppingListResponse,
    ShoppingListItemCreate,
    ShoppingListItemUpdate,
    ShoppingListItemResponse,
    ShoppingListGenerateRequest,
    GroceryAnalyticsSpending,
    GroceryAnalyticsByCategory,
    GroceryAnalyticsByNecessity,
    GroceryInsights,
    GroceryBudgetStatus,
    PriceHistoryResponse,
    CheapestPriceResponse,
)
from .services import (
    GroceryService,
    ShoppingListService,
    GroceryAnalyticsService,
    PriceTrackingService,
)

__all__ = [
    "router",
    # Schemas
    "GroceryProductCreate",
    "GroceryProductUpdate",
    "GroceryProductResponse",
    "GroceryPurchaseCreate",
    "GroceryPurchaseBulkCreate",
    "GroceryPurchaseUpdate",
    "GroceryPurchaseResponse",
    "GroceryPurchaseSummary",
    "GroceryPurchaseComparison",
    "ShoppingListCreate",
    "ShoppingListUpdate",
    "ShoppingListResponse",
    "ShoppingListItemCreate",
    "ShoppingListItemUpdate",
    "ShoppingListItemResponse",
    "ShoppingListGenerateRequest",
    "GroceryAnalyticsSpending",
    "GroceryAnalyticsByCategory",
    "GroceryAnalyticsByNecessity",
    "GroceryInsights",
    "GroceryBudgetStatus",
    "PriceHistoryResponse",
    "CheapestPriceResponse",
    # Services
    "GroceryService",
    "ShoppingListService",
    "GroceryAnalyticsService",
    "PriceTrackingService",
]
