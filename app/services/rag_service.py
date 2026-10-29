"""ChromaDB Multi-Collection RAG Service for NutriVision AI.

Manages 4 distinct domain collections:
  1. `bd_recipes_and_hidden_ingredients`
  2. `clinical_nutrition_guidelines`
  3. `bd_market_and_seasonal_produce`
  4. `packaged_food_facts_bd`

Provides auto-seeding on startup, vector embeddings via ChromaDB's default
embedding function or metadata filtering, and authoritative citation generation.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field

log = logging.getLogger(__name__)

DEFAULT_CHROMA_PATH = "app/cache/chroma"


class RAGChunk(BaseModel):
    id: str
    document: str
    metadata: dict[str, Any]
    distance: float | None = None
    citation: str = ""


class RAGQueryRequest(BaseModel):
    query: str
    collection_name: str
    filters: dict[str, Any] | None = None
    top_k: int = Field(default=3, ge=1, le=10)


class RAGQueryResponse(BaseModel):
    query: str
    collection: str
    results: list[RAGChunk]


# ── Seed Documents for the 4 Collections ───────────────────────────────────

COLLECTION_SEEDS: dict[str, list[dict[str, Any]]] = {
    "bd_recipes_and_hidden_ingredients": [
        {
            "id": "recipe-shorshe-ilish",
            "document": (
                "পদ্মার সর্ষে ইলিশ (Shorshe Ilish): Authentic Hilsa fish steak cooked in freshly ground "
                "mustard paste, green chilies, and pure mustard oil. High in natural omega-3 fatty acids "
                "(EPA/DHA). Hidden factors: Ground mustard seeds add ~180mg natural sodium per serving; "
                "sharp pungency comes from allyl isothiocyanate. Glycemic Load: < 0.1 (negligible). "
                "Serving size: 160g."
            ),
            "metadata": {
                "dish_name": "Shorshe Ilish",
                "dish_name_bn": "সর্ষে ইলিশ",
                "cooking_medium": "Mustard oil",
                "glycemic_rating": "very_low",
                "clinical_tag": "high_protein_omega3",
                "citation": "INFS / Bangladesh Traditional Culinary Compendium",
            },
        },
        {
            "id": "recipe-bhuna-khichuri",
            "document": (
                "ভুনা খিচুড়ি (Bhuna Khichuri): Aromatic Chinigura rice and roasted Moong dal slow-cooked "
                "with whole spices, ginger, and ghee. High carbohydrate density (~54g carbs per 200g serving). "
                "Cooking medium: Ghee and mustard oil. Glycemic Load: High (~24 per portion). Hidden factors: "
                "Ghee adds 12g saturated fat per serving."
            ),
            "metadata": {
                "dish_name": "Bhuna Khichuri",
                "dish_name_bn": "ভুনা খিচুড়ি",
                "cooking_medium": "Ghee / Mustard oil",
                "glycemic_rating": "high",
                "clinical_tag": "diabetic_caution",
                "citation": "INFS / Bangladesh Traditional Culinary Compendium",
            },
        },
        {
            "id": "recipe-kacchi-biryani",
            "document": (
                "পুরান ঢাকার কাচ্চি বিরিয়ানি (Old Dhaka Kacchi Biryani): Marinated raw mutton layered with "
                "spiced potatoes and basmati/chinigura rice. Extremely energy dense: ~780 kcal per 320g portion. "
                "High saturated fat from mutton marrow and ghee. Hidden elements: Fried onions (beresta), "
                "added raisins, sugar in marinade, and sodium (~720mg)."
            ),
            "metadata": {
                "dish_name": "Kacchi Biryani",
                "dish_name_bn": "কাচ্চি বিরিয়ানি",
                "cooking_medium": "Ghee / Animal fat",
                "glycemic_rating": "high",
                "clinical_tag": "hyperlipidemia_caution",
                "citation": "INFS / Bangladesh Traditional Culinary Compendium",
            },
        },
        {
            "id": "recipe-rui-macher-jhol",
            "document": (
                "রুই মাছের পাতলা ঝোল (Rui Macher Patla Jhol): Rohu fish cooked in a light cumin, ginger, "
                "and turmeric stew with raw papaya and potatoes. Ideal for diabetic and cardiovascular wellness. "
                "Cooking medium: Cold-pressed mustard oil. Moderate sodium (~220mg). Glycemic Load: Low (8). "
                "Portion: 220g."
            ),
            "metadata": {
                "dish_name": "Rui Macher Jhol",
                "dish_name_bn": "রুই মাছের ঝোল",
                "cooking_medium": "Mustard oil",
                "glycemic_rating": "low",
                "clinical_tag": "cardio_friendly",
                "citation": "BIRDEM Dietary Guide for Bangladeshi Diabetics",
            },
        },
        {
            "id": "recipe-dim-bhaji",
            "document": (
                "ডিম ভাজি (Dim Bhaji / Bangladeshi Omelette): Farm egg whisked with sliced shallots, "
                "green chilies, salt, and shallow fried in mustard oil. 6.5g complete protein per egg. "
                "Hidden factors: Oil absorption ranges between 8-12g depending on pan temperature."
            ),
            "metadata": {
                "dish_name": "Dim Bhaji",
                "dish_name_bn": "ডিম ভাজি",
                "cooking_medium": "Mustard oil / Soybean oil",
                "glycemic_rating": "zero",
                "clinical_tag": "high_protein",
                "citation": "INFS Food Composition Table for Bangladesh",
            },
        },
        {
            "id": "recipe-masoor-dal",
            "document": (
                "মসুর ডাল (Masoor Dal / Red Lentil Soup): Split red lentils boiled with turmeric and tempered "
                "(phoron) with garlic, dry red chili, and onions in mustard oil. Delivers 8g plant protein "
                "and 4.2g soluble fiber per 150ml bowl. Low glycemic impact (GL: ~6)."
            ),
            "metadata": {
                "dish_name": "Masoor Dal",
                "dish_name_bn": "মসুর ডাল",
                "cooking_medium": "Mustard oil",
                "glycemic_rating": "low",
                "clinical_tag": "diabetic_friendly",
                "citation": "INFS Food Composition Table for Bangladesh",
            },
        },
    ],
    "clinical_nutrition_guidelines": [
        {
            "id": "guideline-birdem-rice-portion",
            "document": (
                "BIRDEM Diabetic Rice & Carbohydrate Standard: Individuals with Type 2 diabetes or "
                "prediabetes should strictly limit plain white rice (Miniket/Nazirshail) to 120-150g cooked "
                "weight per meal (approx 35-40g net carbs). Swapping 50% of rice with non-starchy leafy greens "
                "(Palong, Lal Shak) or unpolished brown rice (Lal Chal) reduces peak glucose by 40%."
            ),
            "metadata": {
                "clinical_tag": "diabetic",
                "authority": "BIRDEM / INFS",
                "target_condition": "diabetes_t2",
                "citation": "BIRDEM / INFS Diabetes Protocol (2024)",
            },
        },
        {
            "id": "guideline-who-sodium-hypertension",
            "document": (
                "WHO Sodium Restriction for Hypertension: Adults with elevated blood pressure or hypertension "
                "must restrict daily sodium to < 1500-2000mg (< 5g salt). Bangladeshi meals typically exceed "
                "this due to added table salt (kacha labon) and salted gravies. Avoid drinking cooking gravy "
                "and restrict pickled items (achar)."
            ),
            "metadata": {
                "clinical_tag": "hypertension",
                "authority": "WHO / Bangladesh Heart Foundation",
                "target_condition": "hypertension",
                "citation": "WHO / BHF Clinical Sodium Guidelines",
            },
        },
        {
            "id": "guideline-icmr-macro-split",
            "document": (
                "ICMR South Asian Dietary Guidelines: South Asian populations display higher abdominal adiposity "
                "and insulin resistance at lower BMI thresholds. Recommended macronutrient distribution: "
                "Carbohydrates 45-50%, Proteins 20-25% (1.0-1.2g/kg body weight), Fats 25-30% with minimal "
                "industrial trans fats. Target daily dietary fiber >= 35g."
            ),
            "metadata": {
                "clinical_tag": "macro_split",
                "authority": "ICMR-NIN",
                "target_condition": "general_metabolic",
                "citation": "ICMR-NIN South Asian Dietary Guidelines",
            },
        },
        {
            "id": "guideline-kdoqi-renal-protein",
            "document": (
                "KDOQI Renal Nutrition Guidelines: Individuals with impaired kidney function (eGFR < 60) "
                "require dietary protein control at 0.6-0.8g/kg/day to minimize glomerular hyperfiltration, "
                "paired with strict sodium and phosphorus monitoring from preserved or processed foods."
            ),
            "metadata": {
                "clinical_tag": "renal",
                "authority": "National Kidney Foundation / KDOQI",
                "target_condition": "kidney",
                "citation": "KDOQI Clinical Practice Guidelines for Renal Nutrition",
            },
        },
    ],
    "bd_market_and_seasonal_produce": [
        {
            "id": "market-winter-vegetables",
            "document": (
                "Winter Harvest (শীতকালীন শাকসবজি): November to February brings peak harvest for cauliflower "
                "(Phulkopi ৳35-45/pc), cabbage (Badhakopi ৳30-40/pc), country flat beans (Shim ৳60-75/kg), "
                "spinach (Palong Shak ৳20-25/bundle), and fresh tomatoes (৳50-60/kg). Best seasonal window "
                "for low-cost, high-fiber, low-calorie dietary pivots."
            ),
            "metadata": {
                "season": "winter",
                "category": "produce",
                "market": "Dhaka / Kawran Bazar",
                "citation": "DAM (Department of Agricultural Marketing) Seasonal Bulletin",
            },
        },
        {
            "id": "market-summer-produce",
            "document": (
                "Summer Harvest (গ্রীষ্মকালীন শাকসবজি): March to June features pointed gourd (Potol ৳50-65/kg), "
                "okra (Dherosh ৳55-70/kg), bitter gourd (Korola ৳70-85/kg), and bottle gourd (Lau ৳50-70/pc). "
                "High water content, excellent for blood sugar regulation and hydration."
            ),
            "metadata": {
                "season": "summer",
                "category": "produce",
                "market": "Dhaka / Kawran Bazar",
                "citation": "DAM (Department of Agricultural Marketing) Seasonal Bulletin",
            },
        },
        {
            "id": "market-tcb-staples",
            "document": (
                "TCB Benchmark Staple Prices: Miniket rice ৳68-74/kg, Lal chal (unpolished brown rice) ৳85-95/kg, "
                "Whole wheat atta ৳55-60/kg, Masoor dal fine ৳140-160/kg, Brown eggs ৳135-145/dozen, Broiler chicken "
                "৳190-210/kg, Soybean oil ৳165-175/L, Mustard oil ৳280-310/L."
            ),
            "metadata": {
                "season": "year_round",
                "category": "staples",
                "market": "TCB Benchmark",
                "citation": "Trading Corporation of Bangladesh (TCB) Daily Price Index",
            },
        },
    ],
    "packaged_food_facts_bd": [
        {
            "id": "packaged-pran-mango-frooto",
            "document": (
                "Pran Frooto Mango Fruit Drink: Sugar-sweetened beverage containing 14.2g added sucrose per 100ml. "
                "One 250ml bottle delivers ~35.5g sugar (142 kcal) with 0g fiber. Severe glycemic spike trigger."
            ),
            "metadata": {
                "brand": "Pran",
                "product_type": "beverage",
                "ultra_processed": True,
                "citation": "BSTI / Bangladesh National Food Quality Control",
            },
        },
        {
            "id": "packaged-aarong-cow-milk",
            "document": (
                "Aarong Dairy Pasteurized Pure Cow Milk: 100% natural cow milk containing 3.5% fat, 3.2g protein, "
                "and 120mg bioavailable calcium per 100ml. Free from added preservatives, sugar, or synthetic thickeners."
            ),
            "metadata": {
                "brand": "Aarong Dairy / BRAC",
                "product_type": "dairy",
                "ultra_processed": False,
                "citation": "BSTI Grade A Dairy Standard",
            },
        },
        {
            "id": "packaged-radhuni-mustard-oil",
            "document": (
                "Radhuni Pure Mustard Oil (Square Consumer Products): Cold-pressed expeller mustard oil with "
                "natural pungency. 0g sodium, 0g sugar. High in monounsaturated fats (erucic and oleic acid). "
                "Traditional culinary fat of Bengal."
            ),
            "metadata": {
                "brand": "Radhuni / Square",
                "product_type": "oil",
                "ultra_processed": False,
                "citation": "BSTI Edible Oil Quality Protocol",
            },
        },
    ],
}


class RAGService:
    """Manages multi-collection nutrition RAG using ChromaDB with auto-seeding."""

    def __init__(self, path: Path | str | None = None) -> None:
        raw = path or os.environ.get("CHROMA_CACHE_PATH") or DEFAULT_CHROMA_PATH
        self.path = Path(raw)
        self.path.mkdir(parents=True, exist_ok=True)
        self._client: Any | None = None
        self._collections: dict[str, Any] = {}
        self._seeded = False

    def _get_client(self) -> Any | None:
        if self._client is not None:
            return self._client
        try:
            import chromadb
            self._client = chromadb.PersistentClient(path=str(self.path))
            return self._client
        except Exception as exc:  # noqa: BLE001
            log.warning("ChromaDB client initialization failed: %s", exc)
            return None

    def ensure_collections(self) -> None:
        """Seed all 4 collections on first run if empty."""
        client = self._get_client()
        if client is None or self._seeded:
            return

        for col_name, seed_docs in COLLECTION_SEEDS.items():
            try:
                col = client.get_or_create_collection(
                    name=col_name,
                    metadata={"hnsw:space": "cosine"},
                )
                self._collections[col_name] = col

                # Check if collection has documents
                existing_count = col.count()
                if existing_count == 0 and seed_docs:
                    ids = [d["id"] for d in seed_docs]
                    documents = [d["document"] for d in seed_docs]
                    metadatas = [d["metadata"] for d in seed_docs]
                    col.add(ids=ids, documents=documents, metadatas=metadatas)
                    log.info("Seeded %d documents into ChromaDB collection '%s'", len(ids), col_name)
            except Exception as exc:  # noqa: BLE001
                log.warning("Failed ensuring collection '%s': %s", col_name, exc)

        self._seeded = True

    def query(
        self,
        collection_name: str,
        query_text: str,
        filters: dict[str, Any] | None = None,
        top_k: int = 3,
    ) -> list[RAGChunk]:
        """Query a specific collection with optional metadata filters and return matched chunks."""
        self.ensure_collections()
        col = self._collections.get(collection_name)
        if col is None:
            client = self._get_client()
            if client is None:
                return []
            try:
                col = client.get_collection(name=collection_name)
                self._collections[collection_name] = col
            except Exception:
                return []

        try:
            kwargs: dict[str, Any] = {
                "query_texts": [query_text],
                "n_results": top_k,
            }
            if filters:
                kwargs["where"] = filters

            res = col.query(**kwargs)
            chunks: list[RAGChunk] = []

            ids = res.get("ids", [[]])[0]
            docs = res.get("documents", [[]])[0]
            metadatas = res.get("metadatas", [[]])[0]
            distances = res.get("distances", [[]])[0] if "distances" in res else []

            for i, chunk_id in enumerate(ids):
                doc = docs[i] if i < len(docs) else ""
                meta = metadatas[i] if i < len(metadatas) else {}
                dist = distances[i] if i < len(distances) else None
                citation = meta.get("citation", "Official Nutrition Benchmark")
                chunks.append(
                    RAGChunk(
                        id=str(chunk_id),
                        document=str(doc),
                        metadata=meta,
                        distance=float(dist) if dist is not None else None,
                        citation=str(citation),
                    )
                )
            return chunks
        except Exception as exc:  # noqa: BLE001
            log.warning("RAG query failed on collection '%s': %s", collection_name, exc)
            return []


# Process-wide singleton
_rag_service: RAGService | None = None


def get_rag_service() -> RAGService:
    global _rag_service
    if _rag_service is None:
        _rag_service = RAGService()
    return _rag_service
