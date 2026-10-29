"""Multi-Agent AI Coach Service for NutriVision AI.

Coordinates two specialized agent personas:
  1. 🔬 Culinary & Nutrition Scientist (পুষ্টি বিজ্ঞানী):
     Grounded in biochemistry, BIRDEM/INFS glycemic indices, hidden sodium/oil calculations,
     macronutrient partitioning, and RAG clinical nutrition knowledge.
  2. 🧠 Behavioral & Habit Coach (আচরণ ও অভ্যাস কোচ):
     Grounded in CBT/habit loops, non-judgmental empathy, friction-reduction, and
     culturally nuanced Bangladeshi context (navigating family dawats, tea-stall adda, cravings).

Provides an LLM cascade:
  Gemini 2.0 Flash (Primary) → Groq (Llama-3.3-70b / Llama-3.2-11b-vision) → Local RAG Synthesizer.
"""

from __future__ import annotations

import base64
import logging
import os
import re
from typing import Any

import httpx

from app.models.schemas import (
    CoachAgentType,
    CoachChatRequest,
    CoachChatResponse,
    CoachMessage,
    MealEntry,
    UserProfile,
)
from app.services.rag_service import get_rag_service


log = logging.getLogger(__name__)

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models"
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"


# ── System Prompts ─────────────────────────────────────────────────────────

SCIENTIST_SYSTEM_PROMPT = """\
You are Dr. Tanvir Hossain, a Senior Clinical Nutritionist & Food Biochemist (পুষ্টি বিজ্ঞানী) specializing in South Asian and Bangladeshi nutrition at NutriVision AI.

Your Clinical Guidelines:
1. Ground every recommendation in biochemical and physiological mechanisms:
   - Glycemic Index (GI) and Glycemic Load (GL) dynamics per BIRDEM guidelines.
   - Lipid profiles, saturated vs polyunsaturated fats, mustard oil vs palm/soybean oil.
   - Sodium-potassium balance, vascular hypertension, and renal protein loads.
2. Deconstruct traditional cooking methods:
   - Deep frying vs shallow sauteing vs boiling/steaming.
   - Oil absorption rates (e.g. eggplant/begun bhaji absorbs up to 35% oil by weight).
   - Hidden sodium in pickles, bhortas, and restaurant stocks.
3. Be specific with numbers, gram adjustments, and evidence:
   - Recommend exact swaps (e.g. replacing 100g white rice with 60g brown rice + 40g leafy greens blunts glucose spikes by 35%).
4. Always incorporate the user's clinical profile (diabetes, hypertension, kidney disease, allergies) and daily nutrient targets.
5. Provide official citations in brackets, such as [উৎস: BIRDEM গাইডলাইন], [উৎস: INFS ডাটা], or [উৎস: ICMR/WHO প্রটোকল].
6. Language: If the user communicates in Bengali, respond in natural, professional, authentic Bengali script. If in English, respond in clear English.
7. Always end with a brief scientific takeaway or actionable clinical tip.
"""

BEHAVIORAL_SYSTEM_PROMPT = """\
You are Farhana Ahmed, an Empathetic Health Psychologist & Behavioral Habit Coach (আচরণ ও অভ্যাস কোচ) at NutriVision AI.

Your Coaching Philosophy:
1. Warm, non-judgmental, compassionate, and positive psychology oriented (CBT & Tiny Habits):
   - Zero guilt, zero shame, zero restrictive diet culture.
   - Eating should be enjoyable, cultural, and nourishing.
2. Culturally deeply grounded in Bangladeshi life:
   - Understands the social reality of family dawats, wedding feasts (kacchi biryani), evening tea-stall adda (cha + biscuits), and sweet cravings.
   - If a user overate or slipped up, validate their experience: "দাওয়াতে আনন্দ করে খাওয়া জীবনের অংশ, কোনো অপরাধবোধের দরকার নেই!"
   - Offer low-friction recovery habits: a 15-minute gentle post-meal walk (শতপদ), drinking warm water, or eating a fiber-rich dal/salad meal next.
3. Focus on small daily wins and habit loops (Cue → Routine → Reward):
   - Rather than banning foods, add nourishing foods first ("চালের সাথে একটু বেশি সবজি যোগ করি").
   - Help overcome emotional eating and late-night cravings with mindfulness techniques.
4. Language: If the user communicates in Bengali, speak with warmth, empathy, and natural Bengali idioms. If in English, be warm, friendly, and practical.
5. Keep advice concise, encouraging, and easy to do today without special equipment or stress.
"""


class CoachService:
    """Multi-agent AI Coach service connecting LLMs and RAG knowledge."""

    def __init__(
        self,
        gemini_api_key: str | None = None,
        groq_api_key: str | None = None,
    ) -> None:
        self.gemini_key = gemini_api_key or os.environ.get("GEMINI_API_KEY", "").strip()
        self.groq_key = groq_api_key or os.environ.get("GROQ_API_KEY", "").strip()

    def chat(self, req: CoachChatRequest) -> CoachChatResponse:
        """Route coach chat through RAG enrichment, provider cascade, and response synthesis."""
        agent_type = req.agent_type
        user_msg = self._extract_latest_user_text(req.messages)

        # 1. RAG Enrichment
        rag_context, citations = self._retrieve_rag_context(user_msg, req.user_profile)

        # 2. Build full context payload
        system_prompt = self._build_system_prompt(
            agent_type=agent_type,
            user_profile=req.user_profile,
            recent_meals=req.recent_meals,
            rag_context=rag_context,
        )

        # 3. Provider Cascade: Gemini -> Groq -> Local RAG fallback
        reply_text = self._call_gemini(system_prompt, req.messages)
        if not reply_text:
            reply_text = self._call_groq(system_prompt, req.messages)
        if not reply_text:
            reply_text = self._synthesize_local_response(agent_type, user_msg, req.user_profile, rag_context)

        # 4. Generate contextual follow-up prompt chips
        suggested_prompts = self._generate_suggested_prompts(agent_type, user_msg, reply_text)

        # 5. Extract or preserve citations
        final_citations = self._resolve_citations(reply_text, citations)

        return CoachChatResponse(
            reply=reply_text,
            citations=final_citations,
            suggested_prompts=suggested_prompts,
            agent_type=agent_type,
        )

    def _extract_latest_user_text(self, messages: list[CoachMessage]) -> str:
        for m in reversed(messages):
            if m.role == "user" and m.content:
                return m.content
        return ""

    def _retrieve_rag_context(
        self,
        query: str,
        profile: UserProfile | None,
    ) -> tuple[str, list[str]]:
        """Query ChromaDB domain collections for clinical or recipe evidence."""
        rag = get_rag_service()
        citations: list[str] = []
        contexts: list[str] = []

        # Determine target collections based on query keywords
        search_terms = query.lower()
        collections_to_search: list[str] = []

        if any(w in search_terms for w in ["glycemic", "গ্লাইসেমিক", "ডায়াবেটিস", "blood pressure", "রক্তচাপ", "লবণ", "sodium", "কিডনি", "kidney"]):
            collections_to_search.append("clinical_nutrition_guidelines")
        if any(w in search_terms for w in ["তেল", "oil", "রান্না", "cooking", "রেসিপি", "recipe", "ইলিশ", "পোলাও", "খিচুড়ি", "বিরিয়ানি"]):
            collections_to_search.append("bd_recipes_and_hidden_ingredients")
        if any(w in search_terms for w in ["দাম", "বাজার", "price", "budget", "বাজেট", "মৌসুমি"]):
            collections_to_search.append("bd_market_and_seasonal_produce")

        if not collections_to_search:
            collections_to_search = ["clinical_nutrition_guidelines", "bd_recipes_and_hidden_ingredients"]

        for col_name in collections_to_search[:2]:
            try:
                chunks = rag.query(collection_name=col_name, query_text=query or "nutrition guidance", top_k=2)
                for chunk in chunks:
                    contexts.append(chunk.document)
                    if chunk.citation and chunk.citation not in citations:
                        citations.append(chunk.citation)
            except Exception as e:
                log.warning("RAG retrieval failed for collection %s: %s", col_name, e)

        joined_context = "\n---\n".join(contexts) if contexts else ""
        return joined_context, citations

    def _build_system_prompt(
        self,
        agent_type: CoachAgentType,
        user_profile: UserProfile | None,
        recent_meals: list[MealEntry] | None,
        rag_context: str,
    ) -> str:
        base = SCIENTIST_SYSTEM_PROMPT if agent_type == "scientist" else BEHAVIORAL_SYSTEM_PROMPT
        sections: list[str] = [base]

        if user_profile:
            conds = ", ".join(user_profile.medical_conditions) or "none"
            allergens = ", ".join(user_profile.allergens) or "none"
            sections.append(
                f"\n[USER HEALTH CONTEXT]\n"
                f"- Name: {user_profile.name or 'User'}\n"
                f"- Age: {user_profile.age}, Sex: {user_profile.sex}\n"
                f"- Weight: {user_profile.weight_kg} kg, Height: {user_profile.height_cm} cm\n"
                f"- Goal: {user_profile.goal}, Activity: {user_profile.activity_level}\n"
                f"- Target Kcal: {user_profile.daily_kcal_target or 2000} kcal/day\n"
                f"- Diet: {user_profile.diet_type}\n"
                f"- Medical conditions: {conds}\n"
                f"- Allergens: {allergens}\n"
                f"- Daily Food Budget: ৳{user_profile.budget} BDT\n"
            )

        if recent_meals:
            meal_lines = []
            for m in recent_meals[-3:]:
                items_str = ", ".join([f"{it.name} ({it.grams}g)" for it in m.items[:4]])
                meal_lines.append(f"- {m.date[:10]} {m.label}: {items_str} [Total: {int(m.totals.kcal)} kcal]")
            if meal_lines:
                sections.append(f"\n[RECENT LOGGED MEALS]\n" + "\n".join(meal_lines))

        if rag_context:
            sections.append(f"\n[AUTHORITATIVE DOMAIN EVIDENCE & RAG CITATIONS]\n{rag_context}")

        return "\n".join(sections)

    def _call_gemini(self, system_prompt: str, messages: list[CoachMessage]) -> str | None:
        if not self.gemini_key:
            return None

        url = f"{GEMINI_API_URL}/gemini-2.0-flash:generateContent"
        headers = {
            "Content-Type": "application/json",
            "x-goog-api-key": self.gemini_key,
        }

        # Build contents array
        gemini_contents = []
        for m in messages:
            role = "user" if m.role == "user" else "model"
            parts: list[dict[str, Any]] = []

            # Add image if provided
            if m.image_ref:
                raw_b64 = m.image_ref
                mime_type = "image/jpeg"
                if "base64," in raw_b64:
                    header, _, raw_b64 = raw_b64.partition("base64,")
                    if "image/png" in header:
                        mime_type = "image/png"
                    elif "image/webp" in header:
                        mime_type = "image/webp"
                parts.append({"inline_data": {"mime_type": mime_type, "data": raw_b64}})

            parts.append({"text": m.content or "Please analyze this."})
            gemini_contents.append({"role": role, "parts": parts})

        body = {
            "system_instruction": {"parts": [{"text": system_prompt}]},
            "contents": gemini_contents,
            "generationConfig": {
                "temperature": 0.4,
                "maxOutputTokens": 800,
            },
        }

        try:
            with httpx.Client(timeout=15.0) as client:
                res = client.post(url, headers=headers, json=body)
                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        content_parts = candidates[0].get("content", {}).get("parts", [])
                        texts = [p.get("text", "") for p in content_parts if "text" in p]
                        return "".join(texts).strip()
                log.warning("Gemini coach chat failed: %s %s", res.status_code, res.text[:200])
        except Exception as exc:
            log.warning("Gemini coach request exception: %s", exc)

        return None

    def _call_groq(self, system_prompt: str, messages: list[CoachMessage]) -> str | None:
        if not self.groq_key:
            return None

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.groq_key}",
        }

        groq_messages: list[dict[str, Any]] = [{"role": "system", "content": system_prompt}]
        for m in messages:
            role = "user" if m.role == "user" else "assistant"
            content: list[dict[str, Any]] | str
            if m.image_ref:
                img_url = m.image_ref
                if not img_url.startswith("data:"):
                    img_url = f"data:image/jpeg;base64,{img_url}"
                content = [
                    {"type": "text", "text": m.content or "Please analyze this image."},
                    {"type": "image_url", "image_url": {"url": img_url}},
                ]
            else:
                content = m.content
            groq_messages.append({"role": role, "content": content})

        # Try llama-3.3-70b-versatile for text or llama-3.2-11b-vision-preview if image is present
        has_image = any(bool(m.image_ref) for m in messages)
        model = "llama-3.2-11b-vision-preview" if has_image else "llama-3.3-70b-versatile"

        body = {
            "model": model,
            "messages": groq_messages,
            "temperature": 0.5,
            "max_tokens": 800,
        }

        try:
            with httpx.Client(timeout=15.0) as client:
                res = client.post(GROQ_API_URL, headers=headers, json=body)
                if res.status_code == 200:
                    data = res.json()
                    choices = data.get("choices", [])
                    if choices:
                        return choices[0].get("message", {}).get("content", "").strip()
                log.warning("Groq coach chat failed: %s %s", res.status_code, res.text[:200])
        except Exception as exc:
            log.warning("Groq coach request exception: %s", exc)

        return None

    def _synthesize_local_response(
        self,
        agent_type: CoachAgentType,
        query: str,
        profile: UserProfile | None,
        rag_context: str,
    ) -> str:
        """Intelligent local fallback if neither API key is active or available."""
        q_lower = query.lower()
        is_bn = bool(re.search(r"[\u0980-\u09FF]", query)) or (profile and profile.medical_conditions)

        if agent_type == "scientist":
            if any(w in q_lower for w in ["গ্লাইসেমিক", "glycemic", "ভাত", "rice", "কার্ব", "carb", "ডায়াবেটিস", "diabetes"]):
                if is_bn:
                    return (
                        "🔬 **বায়োকেমিক্যাল পুষ্টি বিশ্লেষণ (Dr. Tanvir Hossain):**\n\n"
                        "সাদা ভাতের (White Rice) গ্লাইসেমিক ইনডেক্স (GI) তুলনামূলকভাবে বেশি (~৭৩)। খাবার গ্রহণের পর দ্রুত গ্লুকোজ স্পাইক রোধ করতে নিচের ৩টি বৈজ্ঞানিক কৌশল অত্যন্ত কার্যকর:\n\n"
                        "১. **ফাইবার বাফার সংযোজন:** প্রতি ১০০ গ্রাম ভাতের সাথে ৫০–৭০ গ্রাম শাকসবজি বা লাল শাক খেলে দ্রবণীয় ফাইবার পরিপাক গতি শ্লথ করে রক্তে শর্করা বৃদ্ধি ৩৫% পর্যন্ত রোধ করে।\n"
                        "২. **রেজিস্ট্যান্ট স্টার্চ বৃদ্ধি:** ভাত রান্নার পর স্বাভাবিক তাপমাত্রায় ঠাণ্ডা করে খেলে অ্যামাইলোজের রেট্রোগ্রেডেশন ঘটে, যা প্রি-বায়োটিক রেজিস্ট্যান্ট স্টার্চে পরিণত হয় এবং গ্লাইসেমিক লোড হ্রাস করে।\n"
                        "৩. **প্রোটিন ও স্বাস্থ্যকর ফ্যাট:** ভাতের সাথে এক বাটি ঘন মসুর ডাল বা ইলিশ/রুই মাছের হালকা ঝোল যুক্ত করলে গ্যাস্ট্রিক এম্পটিইং টাইম দীর্ঘায়িত হয়।\n\n"
                        "[উৎস: BIRDEM ক্লিনিক্যাল গাইডলাইন ও INFS নিউট্রিশন ডাটা]"
                    )
                return (
                    "🔬 **Nutritional Biochemical Analysis (Dr. Tanvir Hossain):**\n\n"
                    "White rice has a high Glycemic Index (GI ~73). To blunt rapid postprandial glucose surges, apply these 3 scientific levers:\n\n"
                    "1. **Soluble Fiber Buffer:** Pair 100g of rice with 60–80g of leafy greens (shak/vegetables) to slow enzyme hydrolysis.\n"
                    "2. **Retrograded Starch:** Cooling cooked rice increases type-3 resistant starch, lowering the overall Glycemic Load.\n"
                    "3. **Protein/Fat Pairing:** Eating fish or thick dal before rice delays gastric emptying.\n\n"
                    "[Source: BIRDEM Clinical Protocols & INFS Nutrition DB]"
                )

            if any(w in q_lower for w in ["তেল", "oil", "রান্না", "ভাজি", "fry", "sodium", "লবণ", "সোডিয়াম"]):
                if is_bn:
                    return (
                        "🔬 **রান্না ও পুষ্টি উপাদান বিশ্লেষণ:**\n\n"
                        "বাংলাদেশী রান্নায় অতিরিক্ত তেল ও সোডিয়াম সাধারণত ভাজি ও ঘন মশলার গ্রেভিতে জমা হয়:\n\n"
                        "• বেগুন বা পটল ভাজি করার সময় প্রায় ৩০–৩৫% তেল শোষণ করে। ভাজার আগে সামান্য হলুদ-লবণ মাখিয়ে ৫ মিনিট রেখে পানি ঝরিয়ে নিলে তেল শোষণ অর্ধেকের নিচে নামে।\n"
                        "• সর্ষের তেল ব্যবহার করলে প্রাকৃতিকভাবে অ্যান্টি-অক্সিডেন্ট ও ওমেগা-৩ পাওয়া যায়, তবে ধোঁয়া ওঠা অতিরিক্ত তাপে গরম করা অনুচিত।\n"
                        "• কাঁচা লবণের বদলে খাবারে লেবুর রস ও কাঁচা মরিচ ব্যবহার করলে সোডিয়াম ইনটেক দৈনিক ১৫০০ মিলিগ্রামের মধ্যে রাখা সম্ভব।\n\n"
                        "[উৎস: ICMR/WHO কার্ডিওভাসকুলার সোডিয়াম গাইডলাইন]"
                    )
                return (
                    "🔬 **Culinary Biochemistry & Sodium Analysis:**\n\n"
                    "In South Asian cooking, oil absorption and sodium spikes concentrate in deep sautés and heavy gravies:\n\n"
                    "• Eggplant/vegetable fry absorbs up to 35% oil. Pre-salting and draining moisture cuts oil uptake by half.\n"
                    "• Cold-pressed mustard oil supplies mono-unsaturated fats and omega-3 without thermal oxidation.\n"
                    "• Substituting lemon juice and green chili for added table salt keeps daily sodium comfortably within the safe < 1500mg bracket.\n\n"
                    "[Source: WHO/ICMR Cardiovascular Dietary Guidelines]"
                )

            # Generic scientist reply
            if is_bn:
                return (
                    "🔬 **পুষ্টি বিজ্ঞানীর পরামর্শ:**\n\n"
                    "আপনার স্বাস্থ্য লক্ষ্য ও ক্লিনিক্যাল প্রোফাইল অনুযায়ী খাদ্য উপাদানগুলোর ভারসাম্য বজায় রাখা অত্যন্ত গুরুত্বপূর্ণ। "
                    "দৈনিক ক্যালোরি বাজেটের মধ্যে প্রোটিন ২৫-৩০%, জটিল কার্বোহাইড্রেট ৪৫-৫০% এবং স্বাস্থ্যকর ফ্যাট ২০-২৫% বণ্টন নিশ্চিত করুন। "
                    "প্রক্রিয়াজাত চিনি ও অতিরিক্ত লবণ পরিহার করে প্রাকৃতিক খাদ্য উপাদান গ্রহণ বিপাকীয় স্বাস্থ্য উন্নত রাখবে।\n\n"
                    "[উৎস: BIRDEM ও INFS নিউট্রিশনাল স্ট্যান্ডার্ড]"
                )
            return (
                "🔬 **Clinical Nutritionist Guidance:**\n\n"
                "According to metabolic biochemistry standards, maintain a macro balance of 25–30% protein, 45–50% unrefined complex carbs, "
                "and 20–25% healthy fats. Prioritize whole-food micronutrients while keeping added sodium under 1500mg daily.\n\n"
                "[Source: BIRDEM & INFS Nutritional Protocols]"
            )

        # Behavioral Coach
        if any(w in q_lower for w in ["দাওয়াত", "dawat", "overeat", "বেশি", "খাওয়া", "mistake", "ভুল", "অপরাধবোধ"]):
            if is_bn:
                return (
                    "🧠 **আচরণ ও অভ্যাস কোচের বার্তা (Farhana Ahmed):**\n\n"
                    "প্রথমেই একটি কথা মনে রাখুন: **দাওয়াতে মন ভরে খাওয়া কোনো ভুল বা অপরাধ নয়!** উৎসব ও আনন্দ আমাদের জীবনের অবিচ্ছেদ্য অংশ।\n\n"
                    "একটি ভারী খাবারের কারণে আপনার এতদিনের অগ্রগতি নষ্ট হয়ে যায় না। নিজেকে দোষারোপ না করে এই সহজ ৩টি পদক্ষেপ নিন:\n"
                    "১. **হালকা হাঁটা:** খাওয়ার আধা ঘণ্টা পর ১৫–২০ মিনিট শান্তভাবে হাঁটুন (শতপদ)। এটি হজমে দারুণ সাহায্য করে।\n"
                    "২. **পর্যাপ্ত পানি পান:** শরীরকে হাইড্রেটেড রাখুন। এটি সোডিয়াম ভারসাম্য ঠিক রাখতে সাহায্য করবে।\n"
                    "৩. **পরবর্তী খাবার স্বাভাবিক রাখুন:** না খেয়ে থাকবেন না (স্টার্ভ করবেন না)। পরের বেলায় সাধারণ শাকসবজি বা পাতলা ডাল দিয়ে স্বাভাবিক খাবার গ্রহণ করুন।\n\n"
                    "আপনি দারুণ করছেন, দীর্ঘমেয়াদী ধারাবাহিকতাই আসল সাফল্য! 💚"
                )
            return (
                "🧠 **Habit Coach Perspective (Farhana Ahmed):**\n\n"
                "First, remember: **Enjoying a family feast or dawat is not a failure!** Food is deeply connected to family and culture.\n\n"
                "One heavy meal does not undo your health journey. Instead of guilt, try these low-friction steps:\n"
                "1. **Gentle Walk:** Take a relaxed 15-minute stroll. It aids digestion and stabilizes energy.\n"
                "2. **Hydrate Well:** Sip water to help flush excess sodium.\n"
                "3. **Return to Rhythm:** Don't skip meals or punish yourself. Just enjoy a light, vegetable-rich meal next.\n\n"
                "Consistency over perfection is what builds lifelong vitality! 💚"
            )

        if any(w in q_lower for w in ["মিষ্টি", "sweet", "craving", "চা", "আড্ডা", "লোভ"]):
            if is_bn:
                return (
                    "🧠 **লোভ ও অভ্যাস নিয়ন্ত্রণ কৌশল:**\n\n"
                    "সন্ধ্যায় চায়ের আড্ডায় মিষ্টি বা বিস্কুটের ক্রেভিং হওয়া খুব স্বাভাবিক। একে পুরোপুরি নিষিদ্ধ না করে অভ্যাস লুপ (Habit Loop) কিছুটা পরিবর্তন করতে পারেন:\n\n"
                    "• **স্মার্ট অল্টারনেটিভ:** চিনির বদলে রং চা বা মসলা চা নিন এবং সাথে একমুঠো ভাজা চিনাবাদাম বা মুড়ি রাখতে পারেন।\n"
                    "• **১০ মিনিটের পজ:** যখনই মিষ্টি খেতে তীব্র ইচ্ছে হবে, ১০ মিনিট অপেক্ষা করুন এবং এক গ্লাস পানি পান করুন। অধিকাংশ ক্রেভিং এই সময়ে কমে যায়।\n"
                    "• **ক্ষুদ্র বিজয়:** সপ্তাহে দু-একদিন ছোট এক টুকরো মিষ্টি উপভোগ করুন সচেতনভাবে, কোনো অপরাধবোধ ছাড়া!\n\n"
                    "নিজের সাথে সদয় হোন, ধীরে ধীরে নতুন রুটিন তৈরি হবে।"
                )
            return (
                "🧠 **Managing Cravings Mindfully:**\n\n"
                "Craving sweets or biscuits during evening tea is completely normal. Don't fight it with sheer willpower—adjust the habit routine:\n\n"
                "• **Smart Pairing:** Switch to black/spice tea paired with roasted peanuts or puffed rice (muri).\n"
                "• **The 10-Minute Pause:** Wait 10 minutes and drink a glass of water when a craving strikes. Often, it subsides.\n"
                "• **Mindful Indulgence:** Savor a small portion without guilt rather than restricting until you binge.\n\n"
                "Gentle adjustments win the marathon!"
            )

        # Generic behavioral reply
        if is_bn:
            return (
                "🧠 **সুস্থ অভ্যাসের ছোট পদক্ষেপ:**\n\n"
                "স্বাস্থ্যকর জীবনযাপন কোনো কড়া নিয়মের কারাগার নয়, এটি নিজের শরীরের যত্ন নেওয়ার একটি সুন্দর উপায়। "
                "প্রতিদিন একবারে বড় পরিবর্তনের চেষ্টা না করে ছোট ছোট অভ্যাস গড়ুন—যেমন প্রতি বেলায় এক গ্লাস অতিরিক্ত পানি বা থালায় কিছু কাঁচা সালাদ যোগ করা। "
                "মনে রাখবেন, আপনার প্রতিটি সচেতন পছন্দই একটি বিজয়! আপনি আজ কোন ছোট অভ্যাসটি শুরু করতে চান?"
            )
        return (
            "🧠 **Small Daily Habit Sparks:**\n\n"
            "Healthy eating isn't about rigid restrictions; it's about making small, compassionate upgrades. "
            "Focus on adding nourishment first—like an extra glass of water or a bowl of crunchy salad before meals. "
            "Every mindful choice counts towards your long-term wellbeing!"
        )

    def _generate_suggested_prompts(
        self,
        agent_type: CoachAgentType,
        query: str,
        reply: str,
    ) -> list[str]:
        """Produce 2-3 dynamic, contextual follow-up prompt chips."""
        q_lower = query.lower()
        if agent_type == "scientist":
            if "ভাত" in q_lower or "rice" in q_lower or "glycemic" in q_lower:
                return [
                    "রান্নায় তেল শোষণ কমানোর বৈজ্ঞানিক পদ্ধতি কী?",
                    "ভাতের বিকল্প হিসেবে লাল আটার রুটি কতটা ভালো?",
                    "ডায়াবেটিসে কোন দেশীয় ফল নিরাপদে খাওয়া যায়?",
                ]
            if "oil" in q_lower or "তেল" in q_lower or "সোডিয়াম" in q_lower:
                return [
                    "সর্ষের তেল কি হৃদরোগের জন্য নিরাপদ?",
                    "খাবারে কাঁচা লবণের ঝুঁকি কমানোর সহজ উপায়?",
                    "বাজেট ফ্রেন্ডলি প্রোটিন উৎস কী কী?",
                ]
            return [
                "এই খাবারের গ্লাইসেমিক লোড কীভাবে কমাব?",
                "রান্নায় তেল শোষণ কমানোর বৈজ্ঞানিক পদ্ধতি কী?",
                "ডায়াবেটিস থাকলে বিকালের নাস্তায় কী খাব?",
            ]

        # Behavioral
        if "দাওয়াতে" in q_lower or "dawat" in q_lower or "overeat" in q_lower:
            return [
                "রাতের মিষ্টি বা চায়ের আড্ডার লোভ কীভাবে সামলাব?",
                "ব্যস্ত দিনে হেলদি ডায়েট ধরে রাখার সহজ রুটিন কী?",
                "খাবারের পর অপরাধবোধ কাটানোর মনস্তাত্ত্বিক উপায়?",
            ]
        return [
            "দাওয়াতে অতিরিক্ত খাওয়ার পর কী করব?",
            "রাতের মিষ্টি বা চায়ের আড্ডার লোভ কীভাবে সামলাব?",
            "বাজেট ঠিক রেখে স্বাস্থ্যকর নাস্তা তৈরির টিপস দিন?",
        ]

    def _resolve_citations(self, reply: str, candidate_citations: list[str]) -> list[str]:
        citations = list(candidate_citations)
        # Parse any bracket citations in reply
        found = re.findall(r"\[উৎস:\s*([^\]]+)\]", reply)
        for c in found:
            clean = c.strip()
            if clean and clean not in citations:
                citations.append(clean)

        found_en = re.findall(r"\[Source:\s*([^\]]+)\]", reply)
        for c in found_en:
            clean = c.strip()
            if clean and clean not in citations:
                citations.append(clean)

        if not citations:
            citations = ["BIRDEM ক্লিনিক্যাল গাইডলাইন", "INFS পুষ্টি ডাটাবেজ"]

        return citations[:3]


# Module singleton
_coach_service: CoachService | None = None


def get_coach_service() -> CoachService:
    global _coach_service
    if _coach_service is None:
        _coach_service = CoachService()
    return _coach_service
