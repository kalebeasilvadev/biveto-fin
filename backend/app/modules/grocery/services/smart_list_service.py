"""
Smart List Service - LLM-powered intelligent shopping list generation
"""
import json
from datetime import date, timedelta
from collections import defaultdict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.grocery import (
    ShoppingList,
    ShoppingListItem,
    GroceryPurchase,
    GroceryCategory,
    NecessityType,
    ShoppingListStatus,
    ShoppingListSource,
)
from app.models.user import User
from app.modules.grocery.schemas.smart_list import (
    SmartListGenerateRequest,
    SmartListItemResponse,
    SmartListFullResponse,
    OriginalProductDetail,
    ExcludedItem,
)
from app.modules.grocery.prompts import SMART_LIST_PROMPT, SMART_LIST_RESPONSE_SCHEMA
from app.modules.household.utils import get_household_user_ids


class SmartListService:
    """Service for generating smart shopping lists using LLM"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self._llm_client = None

    def _get_llm_client(self):
        """Get Google Genai client (lazy initialization)"""
        if self._llm_client is None:
            try:
                from google import genai
                api_key = settings.google_api_key
                if not api_key:
                    raise ValueError("GOOGLE_API_KEY nao configurada")
                self._llm_client = genai.Client(api_key=api_key)
            except ImportError:
                raise ImportError("google-genai nao instalado. Execute: pip install google-genai")
        return self._llm_client

    async def generate_smart_list(
        self, user: User, request: SmartListGenerateRequest
    ) -> SmartListFullResponse:
        """Generate a smart shopping list using LLM analysis"""
        # 1. Fetch purchase history
        purchases = await self._fetch_purchases(user, request)

        if not purchases:
            # Return empty list if no purchases found
            return await self._create_empty_list(user, request)

        # 2. Prepare data for LLM
        purchases_data = self._prepare_for_llm(purchases)

        # 3. Call LLM
        llm_response = await self._call_llm(purchases_data, request)

        # 4. Enrich LLM response with original product details
        enriched_items = self._enrich_with_original_products(
            llm_response.get("shopping_list", []),
            purchases
        )

        # 5. Create shopping list in database
        shopping_list = await self._create_shopping_list(
            user, request, enriched_items
        )

        # 6. Build full response
        return self._build_response(
            shopping_list,
            enriched_items,
            llm_response.get("excluded", []),
            llm_response.get("insights", []),
            user
        )

    async def _fetch_purchases(
        self, user: User, request: SmartListGenerateRequest
    ) -> list[GroceryPurchase]:
        """Fetch purchase history for the specified period"""
        household_user_ids = await get_household_user_ids(self.db, user)
        start_date = date.today() - timedelta(days=request.period_days)

        query = select(GroceryPurchase).where(
            GroceryPurchase.purchase_date >= start_date
        ).options(
            selectinload(GroceryPurchase.merchant)
        )

        if household_user_ids:
            query = query.where(GroceryPurchase.user_id.in_(household_user_ids))
        else:
            query = query.where(GroceryPurchase.user_id == user.id)

        if not request.include_non_essential:
            query = query.where(
                GroceryPurchase.necessity_type == NecessityType.ESSENTIAL.value
            )

        # Limit to avoid token overflow (max 300 items)
        query = query.order_by(GroceryPurchase.purchase_date.desc()).limit(300)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    def _prepare_for_llm(self, purchases: list[GroceryPurchase]) -> str:
        """Prepare purchase data as compact JSON for LLM"""
        items = []
        for p in purchases:
            item = {
                "name": p.product_name,
                "category": p.category,
                "qty": float(p.quantity),
                "price": float(p.unit_price),
                "date": p.purchase_date.isoformat(),
                "unit": p.unit,
            }
            if p.merchant:
                item["merchant"] = p.merchant.name
            items.append(item)

        return json.dumps(items, ensure_ascii=False)

    async def _call_llm(
        self, purchases_json: str, request: SmartListGenerateRequest
    ) -> dict:
        """Call Google Gemini to analyze purchases and generate list"""
        try:
            from google.genai import types
        except ImportError:
            print("[SmartListService] google.genai not available")
            return self._fallback_response()

        client = self._get_llm_client()
        model = settings.vision_model or "gemini-2.0-flash"

        prompt = SMART_LIST_PROMPT.format(
            current_date=date.today().isoformat(),
            purchases_json=purchases_json
        )

        try:
            print(f"[SmartListService] Calling Gemini API with {len(purchases_json)} chars...")
            response = client.models.generate_content(
                model=model,
                contents=[prompt],
                config=types.GenerateContentConfig(
                    temperature=0.2,
                    max_output_tokens=8000,
                    response_mime_type="application/json",
                    response_schema=SMART_LIST_RESPONSE_SCHEMA,
                ),
            )

            response_text = response.text if response else ""
            print(f"[SmartListService] Response length: {len(response_text)} chars")

            return self._parse_llm_response(response_text)

        except Exception as e:
            print(f"[SmartListService] LLM error: {type(e).__name__}: {e}")
            return self._fallback_response()

    def _parse_llm_response(self, response_text: str) -> dict:
        """Parse and validate LLM JSON response"""
        if not response_text:
            return self._fallback_response()

        try:
            data = json.loads(response_text)

            # Validate required fields
            if "shopping_list" not in data:
                data["shopping_list"] = []
            if "excluded" not in data:
                data["excluded"] = []
            if "insights" not in data:
                data["insights"] = []

            return data

        except json.JSONDecodeError as e:
            print(f"[SmartListService] JSON parse error: {e}")
            return self._fallback_response()

    def _fallback_response(self) -> dict:
        """Return empty response when LLM fails"""
        return {
            "shopping_list": [],
            "excluded": [],
            "insights": ["Nao foi possivel analisar o historico. Tente novamente."]
        }

    def _enrich_with_original_products(
        self,
        llm_items: list[dict],
        purchases: list[GroceryPurchase]
    ) -> list[SmartListItemResponse]:
        """Enrich LLM response with original product details"""
        # Create lookup by normalized product name
        purchases_by_name: dict[str, list[GroceryPurchase]] = defaultdict(list)
        for p in purchases:
            name_lower = p.product_name.lower().strip()
            purchases_by_name[name_lower].append(p)

        enriched_items = []
        for item in llm_items:
            original_names = item.get("original_product_names", [])
            original_products = []

            # Find matching purchases for each original name
            for orig_name in original_names:
                name_lower = orig_name.lower().strip()
                for p in purchases_by_name.get(name_lower, []):
                    original_products.append(OriginalProductDetail(
                        product_name=p.product_name,
                        purchase_date=p.purchase_date,
                        unit_price=float(p.unit_price),
                        quantity=float(p.quantity),
                        merchant_name=p.merchant.name if p.merchant else None
                    ))

            # Also try partial matching if exact match not found
            if not original_products:
                for orig_name in original_names:
                    name_parts = orig_name.lower().split()
                    for name_key, p_list in purchases_by_name.items():
                        if any(part in name_key for part in name_parts if len(part) > 3):
                            for p in p_list:
                                if not any(op.product_name == p.product_name and op.purchase_date == p.purchase_date
                                          for op in original_products):
                                    original_products.append(OriginalProductDetail(
                                        product_name=p.product_name,
                                        purchase_date=p.purchase_date,
                                        unit_price=float(p.unit_price),
                                        quantity=float(p.quantity),
                                        merchant_name=p.merchant.name if p.merchant else None
                                    ))

            # Validate and normalize category
            try:
                category = GroceryCategory(item.get("category", "other"))
            except ValueError:
                category = GroceryCategory.OTHER

            # Validate necessity type
            try:
                necessity_type = NecessityType(item.get("necessity_type", "essential"))
            except ValueError:
                necessity_type = NecessityType.ESSENTIAL

            enriched_items.append(SmartListItemResponse(
                product_type=item.get("product_type", "Produto"),
                display_name=item.get("display_name", item.get("product_type", "Produto")),
                category=category,
                necessity_type=necessity_type,
                suggested_quantity=item.get("suggested_quantity", 1),
                unit=item.get("unit", "un"),
                estimated_price=item.get("estimated_price"),
                urgency=item.get("urgency", "medium"),
                reasoning=item.get("reasoning", ""),
                original_products=original_products,
                purchase_count=item.get("purchase_count", len(original_products)),
                days_since_last_purchase=item.get("days_since_last_purchase", 0),
                avg_cycle_days=item.get("avg_cycle_days")
            ))

        return enriched_items

    async def _create_shopping_list(
        self,
        user: User,
        request: SmartListGenerateRequest,
        items: list[SmartListItemResponse]
    ) -> ShoppingList:
        """Create shopping list with items in database"""
        today = date.today()
        list_name = request.name or f"Lista Inteligente - {today.strftime('%d/%m/%Y')}"

        shopping_list = ShoppingList(
            user_id=user.id,
            license_id=user.license_id,
            name=list_name,
            status=ShoppingListStatus.DRAFT.value,
            source=ShoppingListSource.AI_GENERATED.value,
            ownership_type="household",
            notes=f"Gerada por IA com base nos ultimos {request.period_days} dias. "
                  f"Total: {len(items)} tipos de produtos.",
        )
        self.db.add(shopping_list)
        await self.db.flush()

        # Add items with priority based on urgency
        for item in items:
            priority = 0
            if item.urgency == "high":
                priority = 3
            elif item.urgency == "medium":
                priority = 2
            elif item.necessity_type == NecessityType.ESSENTIAL:
                priority = 1

            db_item = ShoppingListItem(
                list_id=shopping_list.id,
                product_name=item.product_type,
                quantity=item.suggested_quantity,
                unit=item.unit,
                estimated_price=item.estimated_price,
                category=item.category.value,
                necessity_type=item.necessity_type.value,
                priority=priority,
                notes=item.reasoning[:200] if item.reasoning else None,
            )
            self.db.add(db_item)

        await self.db.flush()
        await self.db.refresh(shopping_list)
        return shopping_list

    async def _create_empty_list(
        self, user: User, request: SmartListGenerateRequest
    ) -> SmartListFullResponse:
        """Create an empty response when no purchases found"""
        today = date.today()
        list_name = request.name or f"Lista Inteligente - {today.strftime('%d/%m/%Y')}"

        shopping_list = ShoppingList(
            user_id=user.id,
            license_id=user.license_id,
            name=list_name,
            status=ShoppingListStatus.DRAFT.value,
            source=ShoppingListSource.AI_GENERATED.value,
            ownership_type="household",
            notes=f"Nenhuma compra encontrada nos ultimos {request.period_days} dias.",
        )
        self.db.add(shopping_list)
        await self.db.flush()
        await self.db.refresh(shopping_list)

        return SmartListFullResponse(
            id=shopping_list.id,
            user_id=shopping_list.user_id,
            license_id=shopping_list.license_id,
            name=shopping_list.name,
            notes=shopping_list.notes,
            status=ShoppingListStatus(shopping_list.status),
            source=ShoppingListSource(shopping_list.source),
            ownership_type=shopping_list.ownership_type,
            created_at=shopping_list.created_at,
            updated_at=shopping_list.updated_at,
            items=[],
            excluded=[],
            insights=["Nenhuma compra encontrada no periodo especificado. "
                     "Adicione itens manualmente ou importe cupons fiscais."],
            total_items=0,
            estimated_total=0,
            creator_name=user.name,
        )

    def _build_response(
        self,
        shopping_list: ShoppingList,
        items: list[SmartListItemResponse],
        excluded: list[dict],
        insights: list[str],
        user: User
    ) -> SmartListFullResponse:
        """Build the full response object"""
        # Sort items: high urgency first, then essential, then by name
        items.sort(key=lambda x: (
            {"high": 0, "medium": 1, "low": 2}.get(x.urgency, 2),
            x.necessity_type != NecessityType.ESSENTIAL,
            x.display_name.lower()
        ))

        # Calculate totals
        total_items = len(items)
        estimated_total = sum(
            (item.estimated_price or 0) * item.suggested_quantity
            for item in items
        )

        # Parse excluded items
        excluded_items = [
            ExcludedItem(name=e.get("name", ""), reason=e.get("reason", ""))
            for e in excluded
        ]

        return SmartListFullResponse(
            id=shopping_list.id,
            user_id=shopping_list.user_id,
            license_id=shopping_list.license_id,
            name=shopping_list.name,
            notes=shopping_list.notes,
            status=ShoppingListStatus(shopping_list.status),
            source=ShoppingListSource(shopping_list.source),
            ownership_type=shopping_list.ownership_type,
            created_at=shopping_list.created_at,
            updated_at=shopping_list.updated_at,
            items=items,
            excluded=excluded_items,
            insights=insights[:5],  # Max 5 insights
            total_items=total_items,
            estimated_total=round(estimated_total, 2),
            creator_name=user.name,
        )
