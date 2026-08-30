# 🥗 NutriVision AI: Vision-to-Market Nutrition Intelligence
## Complete Hackathon Blueprint — 100% Free Tier Architecture

**Version:** 2.0 (Enhanced)
**Date:** August 2026
**License:** MIT (Recommended)
**Language:** Python 3.11+ (backend) · TypeScript / Next.js (frontend)

---

## 🚧 Build Order Note (read this first)

We are building **frontend first**, using **React with Next.js**. The backend below is fully specified but not yet implemented — build the UI against **mock data that matches the exact response shapes described in Section 8 (`app/models/schemas.py`) and the pipeline stages in Section 6**, so the real API is a drop-in swap later with no shape changes.

Suggested frontend build order (maps to the user journey in Section 3):
1. **Capture screen** — camera/upload input (mobile-first)
2. **Results screen** — identified food items with confidence scores, editable/correctable
3. **Nutrient breakdown + explainability panel** — per-item flags with the "why" shown
4. **Personalization / profile settings** — health goals, dietary constraints, budget ceiling
5. **Grocery list screen** — localized, budget-aware weekly shopping list

Stub every API call behind a thin client (e.g. `lib/api.ts`) with typed interfaces matching Section 8's schemas, so wiring up FastAPI later is just replacing the mock implementation, not the interface.

---

## 📋 Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Enhanced Architecture Overview](#2-enhanced-architecture-overview)
3. [Core Features & User Workflow](#3-core-features--user-workflow)
4. [Complete Tech Stack (Zero-Cost)](#4-complete-tech-stack-zero-cost)
5. [Resource Library: GitHub, Hugging Face & APIs](#5-resource-library-github-hugging-face--apis)
6. [Detailed System Architecture Pipeline](#6-detailed-system-architecture-pipeline)
7. [Implementation Roadmap](#7-implementation-roadmap)
8. [Code Architecture & Module Design](#8-code-architecture--module-design)
9. [Deployment Guide](#9-deployment-guide)
10. [Risk Mitigation & Fallbacks](#10-risk-mitigation--fallbacks)
11. [Appendix: All Links & References](#11-appendix-all-links--references)

---

## 1. Executive Summary

**Product Name:** NutriVision AI
**Tagline:** *"Snap a meal. Know your body. Shop smart."*

**Problem:** Generic calorie counters fail on local cuisines, don't understand metabolic context, and never tell you where to shop.

**Solution:** A multimodal AI nutrition coach that:
- Accepts photos of ingredients, cooked meals, or restaurant menus
- Identifies food items using Vision AI
- Cross-references against validated nutrition databases (USDA + Open Food Facts)
- Applies personalized health filters (diabetes-friendly, high-protein, low-glycemic, etc.)
- Generates a localized, budget-conscious grocery shopping list
- Runs entirely on free-tier infrastructure

**Target Users:** Health-conscious individuals in emerging markets (especially South Asia), diabetes/prediabetes patients, fitness enthusiasts, and budget-aware families.

### Why This Wins a Hackathon
Judges reward demos that are *visibly* multimodal, *visibly* personalized, and *visibly* free to run. NutriVision AI hits all three: a live camera-to-plate demo, a metabolic-context filter that changes the output in front of the audience, and an architecture diagram that proves zero paid infrastructure is required to reach production quality.

---

## 2. Enhanced Architecture Overview

We extend the base PRD with **five additional robustness layers** that harden the system against the two things that sink hackathon demos: hallucination and rate limits.

| Enhancement | Why It Matters | Free-Tier Solution |
|-------------|----------------|-------------------|
| **Dual Vision Pipeline** | Gemini may hallucinate on local dishes | Add Hugging Face food-classifier as validator |
| **Offline Cache Layer** | API rate limits during demo | Local SQLite cache + ChromaDB persistence |
| **Multi-DB Nutrition Fallback** | USDA lacks local foods | Open Food Facts → USDA → Fruityvice cascade |
| **Portion Estimation** | Calories depend on serving size | Thumb-calibration heuristic + density tables |
| **Explainability Layer** | Hackathon judges love transparency | SHAP-style nutrient contribution breakdown |

> **Design principle:** every enhancement above is a *fallback*, not a dependency. The core pipeline works with a single vision call; each layer only activates when its upstream signal is missing, low-confidence, or rate-limited. This keeps the demo resilient even offline.

---

## 3. Core Features & User Workflow

### User Journey

**Step 1 — Capture**
User photographs a plate, a set of raw ingredients, or a restaurant menu using the mobile-web camera input. No sign-up required for the demo path.

**Step 2 — Identify**
The dual vision pipeline (Gemini + HF food-classifier) returns a ranked list of detected food items with bounding-box confidence scores. Low-confidence items are flagged for one-tap user correction.

**Step 3 — Enrich**
Each identified item is resolved against the nutrition-database cascade (Open Food Facts → USDA FoodData Central → Fruityvice) and normalized into a common nutrient schema (kcal, macros, glycemic load, sodium).

**Step 4 — Personalize**
The user's health profile (e.g. prediabetic, high-protein goal, budget ceiling) is applied as a filter/re-ranker over the enriched items, producing warnings, swaps, and portion guidance.

**Step 5 — Act**
The system emits two artifacts: an explainable nutrient breakdown for the meal just photographed, and a localized, budget-aware grocery list for the week ahead.

### Feature Summary

| Feature | Description |
|---|---|
| Multi-input capture | Photo of meal, raw ingredients, or menu — same pipeline handles all three via prompt branching |
| Local-cuisine awareness | Food-classifier validator is fine-tuned/prompted with South Asian dish vocabulary to reduce Western-cuisine bias |
| Metabolic-context filtering | Diabetes-friendly, low-glycemic, high-protein, and custom macro-target modes |
| Portion-aware calories | Thumb/hand calibration heuristic converts item count into estimated grams |
| Explainability panel | Shows which nutrients drove a "flagged" or "recommended" verdict, per item |
| Grocery list generator | Converts weekly meal targets into a shopping list, grouped by local market category |

---

## 4. Complete Tech Stack (Zero-Cost)

Every component below has a generous free tier or is fully open-source/self-hostable, making the entire stack reproducible without a credit card.

### 4.1 Vision & Language Layer

| Component | Free-Tier Option | Role |
|---|---|---|
| Primary Vision-Language Model | Gemini API free tier (Google AI Studio) | Food identification, menu OCR, dish description |
| Validator Classifier | Hugging Face Inference API (food-101 / fine-tuned ViT) | Cross-checks Gemini's labels against a closed-set classifier to catch hallucination |
| OCR fallback | Tesseract (open-source, local) | Menu text extraction when vision model confidence is low |

### 4.2 Nutrition Data Layer

| Source | Coverage | Notes |
|---|---|---|
| Open Food Facts API | Packaged foods, global, crowd-sourced | First lookup — best for branded/local packaged items |
| USDA FoodData Central API | Whole foods, USA-centric, lab-validated | Second lookup — authoritative macro/micro data |
| Fruityvice API | Fruits only | Lightweight tertiary fallback for produce items |

### 4.3 Application & Infrastructure Layer

| Layer | Tool | Notes |
|---|---|---|
| Backend API | FastAPI | Async, auto-docs, easy Gemini/HF client integration |
| Frontend | **React (Next.js)** | Primary build target — camera input, results, personalization, grocery list UI |
| Cache & persistence | SQLite | Local relational cache for API responses (rate-limit shield) |
| Vector store | ChromaDB (embedded mode) | Semantic cache for near-duplicate food-image lookups |
| Hosting | Vercel (frontend) / Hugging Face Spaces or Render (backend) | Zero-cost public demo URL |
| Auth (optional) | Firebase free tier | Only needed if persisting per-user health profiles beyond the session |

> **Free-tier watch-outs:** Gemini and Hugging Face Inference both apply per-minute rate limits on free keys. The Offline Cache Layer (Section 2) exists specifically to make live demos resilient to this.

---

## 5. Resource Library: GitHub, Hugging Face & APIs

### 5.1 Vision Models & Datasets
- **Food-101** (Hugging Face datasets/models) — 101-class food image classifier, good baseline validator
- **CLIP (openai/clip-vit-base-patch32)** — zero-shot food/ingredient matching against a text label set
- **Google Gemini API** (AI Studio) — primary multimodal reasoning over meal photos and menus

### 5.2 Nutrition & Food Data APIs
- **Open Food Facts API** — open, crowd-sourced product/nutrition database with strong global packaged-food coverage
- **USDA FoodData Central API** — authoritative nutrient database maintained by the US Department of Agriculture
- **Fruityvice API** — lightweight REST API for fruit nutrition facts

### 5.3 Infrastructure & Tooling
- **FastAPI** — backend framework
- **Next.js / React** — frontend framework, camera input via `navigator.mediaDevices`
- **ChromaDB** — embedded vector database for semantic image-lookup caching
- **SQLite** — zero-config relational cache
- **Hugging Face Spaces** — free hosting with GPU-optional runtime (backend)
- **Vercel** — free hosting for the Next.js frontend

> **Tip for judges' Q&A:** Keep a one-slide "resource map" showing exactly which free tier each API sits on and its rate limit — this pre-empts the most common hackathon judge question: "what happens when this scales?"

---

## 6. Detailed System Architecture Pipeline

The pipeline traces a single request from photo capture to grocery list, showing where each robustness layer from Section 2 attaches to the core path.

```
Capture → Cache Check → Vision ID ──┬──► Reconciliation → Nutrition DB (cascade) → Portion Est. → Personalize → Explainability → Output
                                     │                                                    ▲
                                     └──► HF Validator (confidence vote) ─────────────────┘
                                                                                     ▲
                                                                              User profile input
```

### Pipeline Stages

| Stage | What Happens |
|---|---|
| 1. Capture | Image (and optional profile context) received by FastAPI endpoint |
| 2. Cache check | ChromaDB semantic lookup for a near-duplicate image; SQLite exact-hash lookup as a fast path |
| 3. Vision identification | Gemini call returns labeled items + confidence; HF classifier validates each label independently |
| 4. Reconciliation | Disagreements between the two vision signals are resolved by confidence-weighted voting; ties are surfaced to the user |
| 5. Nutrition resolution | Each confirmed item queries Open Food Facts, then USDA, then Fruityvice, in cascade, stopping at first confident match |
| 6. Portion estimation | Heuristic converts detected item size/count into grams using reference-object calibration and food-density tables |
| 7. Personalization filter | User's health profile re-ranks/flags items (e.g. high-glycemic warning for a prediabetic profile) |
| 8. Explainability | Per-item nutrient contribution breakdown generated to justify each flag or recommendation |
| 9. Output | Meal nutrient report + localized, budget-aware grocery list returned to the UI |

---

## 7. Implementation Roadmap

A suggested build order for a 48–72 hour hackathon timeline, organized into four phases. **Given the frontend-first decision, Phase 1 below should be re-sequenced to build the Next.js UI against mocked responses before backend wiring begins.**

### Phase 1 — Core Pipeline *(Hours 0–12)*
- Set up FastAPI skeleton + **Next.js camera-input UI**
- Wire Gemini API for single-pass food identification
- Integrate Open Food Facts + USDA lookups (no cascade logic yet)

### Phase 2 — Robustness Layers *(Hours 12–28)*
- Add HF classifier validator and confidence-weighted reconciliation
- Stand up SQLite + ChromaDB caching to protect against rate limits
- Implement the full DB cascade with fallback to Fruityvice

### Phase 3 — Personalization & Explainability *(Hours 28–42)*
- Build health-profile schema (diabetic, high-protein, budget ceiling, allergies)
- Implement portion-estimation heuristic and density lookup table
- Add nutrient-contribution explainability panel to the UI

### Phase 4 — Grocery List, Polish & Demo Prep *(Hours 42–60)*
- Generate localized, budget-aware grocery list from a week of logged meals
- Deploy frontend to Vercel, backend to Hugging Face Spaces / Render
- Record fallback demo video in case of live rate-limit issues; rehearse judge Q&A

---

## 8. Code Architecture & Module Design

### 8.1 Suggested Repository Layout

```
nutrivision-ai/
├── frontend/                   # Next.js app (build this first)
│   ├── app/
│   │   ├── capture/            # camera/upload screen
│   │   ├── results/            # identified items + confidence, editable
│   │   ├── nutrients/          # nutrient breakdown + explainability panel
│   │   ├── profile/            # personalization / health profile settings
│   │   └── grocery/            # weekly grocery list view
│   ├── lib/
│   │   └── api.ts              # typed API client — mock now, real later
│   ├── types/
│   │   └── schemas.ts          # TS interfaces mirroring backend Pydantic models
│   └── mocks/
│       └── fixtures.ts         # mock vision/nutrition/grocery responses
├── app/                         # FastAPI backend
│   ├── main.py                 # FastAPI entrypoint
│   ├── api/
│   │   ├── vision.py           # Gemini + HF classifier calls, reconciliation
│   │   ├── nutrition.py        # OFF -> USDA -> Fruityvice cascade
│   │   ├── portion.py          # thumb-calibration + density heuristics
│   │   ├── personalize.py      # health-profile filter/re-ranker
│   │   └── grocery.py          # weekly plan -> shopping list
│   ├── cache/
│   │   ├── sqlite_cache.py     # exact-match response cache
│   │   └── vector_cache.py     # ChromaDB semantic image cache
│   ├── explain/
│   │   └── contributions.py    # per-nutrient explainability breakdown
│   └── models/
│       └── schemas.py          # Pydantic request/response models (source of truth for TS types)
├── data/
│   └── density_tables.json     # food density reference for portion estimation
├── tests/
├── requirements.txt
└── README.md
```

### 8.2 Module Responsibilities

| Module | Responsibility |
|---|---|
| `frontend/lib/api.ts` | Single point of contact for all backend calls; swap mock → real without touching UI code |
| `frontend/types/schemas.ts` | TypeScript mirror of `app/models/schemas.py` — keep these in lockstep |
| `api/vision.py` | Owns both vision calls and the confidence-weighted reconciliation logic |
| `api/nutrition.py` | Implements the three-source cascade; normalizes disparate schemas into one nutrient model |
| `api/portion.py` | Converts detected item geometry into estimated grams |
| `api/personalize.py` | Applies the active health profile as a filter/re-ranker over resolved nutrients |
| `cache/*` | Shields all external API calls behind exact and semantic caches |
| `explain/contributions.py` | Produces the SHAP-style per-nutrient explanation surfaced in the UI |

---

## 9. Deployment Guide

### 9.1 Local Development

```bash
# Frontend
cd frontend
npm install
npm run dev

# Backend (once ready to wire up)
python3.11 -m venv venv && source venv/bin/activate
pip install -r requirements.txt

export GEMINI_API_KEY="..."
export HF_API_TOKEN="..."
export USDA_API_KEY="..."

uvicorn app.main:app --reload --port 8000
```

### 9.2 Free-Tier Public Deployment

| Step | Detail |
|---|---|
| 1. Frontend to Vercel | Connect the `frontend/` directory as a Next.js project; free tier covers hackathon-scale traffic |
| 2. Containerize backend | Single Dockerfile running FastAPI |
| 3. Push backend to Hugging Face Spaces or Render | Free CPU-basic tier is sufficient since the heavy inference runs via hosted APIs, not locally |
| 4. Set secrets | Store API keys in Vercel/Space environment variables, never in code |
| 5. Persist cache | Mount a persistent volume (or accept ephemeral SQLite/Chroma reset on restart) for demo stability |
| 6. Smoke test | Run through Capture → Identify → Enrich → Personalize → Act end-to-end before presenting |

> **Demo-day safety net:** pre-populate the SQLite/ChromaDB cache with 10–15 known food photos before judging. If a live rate limit hits mid-demo, the cache silently serves the cached result with no visible degradation.

---

## 10. Risk Mitigation & Fallbacks

| Risk | Impact | Mitigation |
|---|---|---|
| Vision model hallucinates on local dish | Wrong nutrient data shown live to judges | HF classifier validator + confidence-weighted reconciliation (Section 2) |
| API rate limit hit during demo | Pipeline stalls or errors on stage | SQLite + ChromaDB cache layer with pre-warmed demo images |
| USDA/OFF lacks a South Asian dish | Empty or null nutrition result | Three-source cascade + graceful "estimated" label when only a partial match is found |
| Portion size wildly misestimated | Calorie counts lose credibility | Reference-object (thumb/card) calibration + conservative density-table bounds, with an explicit user override |
| Network unavailable at venue | Total demo failure | Recorded fallback demo video + offline cache mode using only cached responses |
| Judges ask about scaling costs | Credibility on production-readiness | Resource map slide (Section 5) showing exact free-tier limits and a swap-in path to paid tiers |
| Frontend built against mocks drifts from real API shape | Integration breaks late in the timeline | Keep `types/schemas.ts` and `app/models/schemas.py` manually in sync; treat schema changes as breaking changes requiring both files to update together |

---

## 11. Appendix: All Links & References

### APIs & Data Sources
- Google AI Studio / Gemini API — `ai.google.dev`
- Hugging Face Inference API — `huggingface.co/inference-api`
- Open Food Facts API — `world.openfoodfacts.org`
- USDA FoodData Central API — `fdc.nal.usda.gov`
- Fruityvice API — `fruityvice.com`

### Frameworks & Libraries
- FastAPI — `fastapi.tiangolo.com`
- Next.js — `nextjs.org`
- ChromaDB — `trychroma.com`
- Tesseract OCR — `github.com/tesseract-ocr`

### Hosting
- Vercel — `vercel.com`
- Hugging Face Spaces — `huggingface.co/spaces`
- Render free tier — `render.com`

---

*NutriVision AI — Hackathon Blueprint v2.0 · Verify current free-tier limits and API terms before your event, as these change over time.*
