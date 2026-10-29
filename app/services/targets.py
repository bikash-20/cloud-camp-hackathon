"""Dynamic nutritional target engine.

Calculates personalized, clinically-grounded daily and per-meal targets
for calories, macronutrients, and micronutrients.

Scientific citations:
- BMR: Mifflin MD, St Jeor ST, Hill JO, Scott BJ, Daugherty SA, Koh YO.
  "A new predictive equation for resting energy expenditure in healthy individuals."
  Am J Clin Nutr 1990; 51:241-247.
- TDEE Activity Factors: Food and Agriculture Organization / WHO / UNU Expert Consultation.
  "Human energy requirements." WHO Technical Report Series 2004; 935.
- AMDR & Fiber: Institute of Medicine. "Dietary Reference Intakes for Energy,
  Carbohydrate, Fiber, Fat, Fatty Acids, Cholesterol, Protein, and Amino Acids."
  Washington, DC: The National Academies Press, 2005.
- Sodium: American Heart Association & WHO Guideline: "Sodium intake for adults and children." 2012.
- Sugar: WHO Guideline: "Sugars intake for adults and children." Geneva: World Health Organization, 2015.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app.models.schemas import DAILY_KCAL_TARGET_DEFAULT, MacroTargets, UserProfile

# Load clinical standards from config file (data, not code)
_STANDARDS_PATH = Path(__file__).resolve().parents[1] / "data" / "nutrition_standards.json"


def _load_standards() -> dict[str, Any]:
    if _STANDARDS_PATH.is_file():
        try:
            return json.loads(_STANDARDS_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass
    # Resilient fallback if config file is unreachable
    return {
        "bmr_formula": {
            "weight_mult": 10.0,
            "height_mult": 6.25,
            "age_mult": 5.0,
            "male_offset": 5.0,
            "female_offset": -161.0,
            "neutral_offset": -78.0,
        },
        "activity_factors": {
            "sedentary": 1.2,
            "light": 1.375,
            "moderate": 1.55,
            "active": 1.725,
            "very_active": 1.9,
        },
        "calorie_safety_floors": {
            "adult_male_min_kcal": 1500.0,
            "adult_female_min_kcal": 1200.0,
            "pediatric_min_kcal": 1000.0,
            "max_daily_deficit_kcal": 1000.0,
            "max_daily_surplus_kcal": 750.0,
        },
        "fiber_standards": {
            "per_1000_kcal_grams": 14.0,
            "pediatric_age_addition": 5.0,
            "diabetic_minimum_grams": 30.0,
        },
        "sodium_limits_mg": {
            "standard_adult": 2300.0,
            "hypertension": 1500.0,
            "kidney_condition": 1500.0,
            "pediatric_under_8": 1200.0,
            "pediatric_8_to_13": 1500.0,
        },
        "sugar_limits": {
            "standard_max_calorie_pct": 0.10,
            "diabetic_max_calorie_pct": 0.05,
            "kcal_per_gram": 4.0,
        },
        "macro_distributions": {
            "default": {"carbs_pct": 0.50, "protein_pct": 0.20, "fat_pct": 0.30},
            "diabetic": {"carbs_pct": 0.38, "protein_pct": 0.25, "fat_pct": 0.37},
            "prediabetic": {"carbs_pct": 0.40, "protein_pct": 0.24, "fat_pct": 0.36},
            "high_protein": {"carbs_pct": 0.40, "protein_pct": 0.32, "fat_pct": 0.28},
        },
        "kidney_protein_limit_g_per_kg": 0.8,
    }


STANDARDS = _load_standards()


def calculate_bmr(weight_kg: float, height_cm: float, age: int, sex: str = "other") -> float:
    """Calculate Basal Metabolic Rate using the Mifflin-St Jeor formula."""
    f = STANDARDS["bmr_formula"]
    w = max(10.0, weight_kg)
    h = max(50.0, height_cm)
    a = max(1, age)

    offset = f["neutral_offset"]
    s = sex.lower().strip()
    if s == "male":
        offset = f["male_offset"]
    elif s == "female":
        offset = f["female_offset"]

    bmr = (f["weight_mult"] * w) + (f["height_mult"] * h) - (f["age_mult"] * a) + offset
    return max(600.0, round(bmr, 1))


def calculate_tdee(bmr: float, activity_level: str = "sedentary") -> float:
    """Calculate Total Daily Energy Expenditure from BMR and activity multiplier."""
    factors = STANDARDS["activity_factors"]
    mult = factors.get(activity_level.lower().strip(), factors.get("sedentary", 1.2))
    return round(bmr * mult, 1)


def calculate_daily_calories(
    tdee: float,
    goal: str = "maintain",
    target_rate_kg_per_week: float = 0.5,
    sex: str = "other",
    age: int = 30,
) -> tuple[float, list[str]]:
    """Derive safe daily calorie target with deficit/surplus limits and clinical floor enforcement."""
    explanations: list[str] = [f"Base TDEE: {round(tdee)} kcal/day."]
    floors = STANDARDS["calorie_safety_floors"]

    # 1 kg fat ~= 7700 kcal
    weekly_cal = max(0.0, min(1.0, target_rate_kg_per_week)) * 7700.0
    daily_delta = weekly_cal / 7.0

    g = goal.lower().strip()
    target_kcal = tdee

    if g == "lose":
        daily_delta = min(floors["max_daily_deficit_kcal"], daily_delta)
        target_kcal = tdee - daily_delta
        explanations.append(f"Applied weight loss deficit of {round(daily_delta)} kcal/day.")
    elif g == "gain":
        daily_delta = min(floors["max_daily_surplus_kcal"], daily_delta)
        target_kcal = tdee + daily_delta
        explanations.append(f"Applied weight gain surplus of {round(daily_delta)} kcal/day.")
    else:
        explanations.append("Maintenance target matches TDEE.")

    # Safety floors
    if age < 12:
        min_floor = floors["pediatric_min_kcal"]
    elif sex.lower() == "female":
        min_floor = floors["adult_female_min_kcal"]
    elif sex.lower() == "male":
        min_floor = floors["adult_male_min_kcal"]
    else:
        min_floor = (floors["adult_male_min_kcal"] + floors["adult_female_min_kcal"]) / 2.0

    if target_kcal < min_floor:
        target_kcal = min_floor
        explanations.append(
            f"Safety limit: Calorie target was adjusted up to the safe clinical floor of {round(min_floor)} kcal "
            "to prevent metabolic slowdown and nutritional deficiency."
        )

    return round(target_kcal, 0), explanations


def calculate_targets(profile: UserProfile | None) -> dict[str, Any]:
    """Calculate personalized targets from UserProfile."""
    if profile is None:
        return {
            "daily": MacroTargets(
                kcal=DAILY_KCAL_TARGET_DEFAULT,
                protein=75.0,
                carbs=250.0,
                fat=65.0,
                fiber=28.0,
                sodium=2300.0,
                sugar=50.0,
            ),
            "per_meal": MacroTargets(
                kcal=round(DAILY_KCAL_TARGET_DEFAULT / 3, 1),
                protein=25.0,
                carbs=83.0,
                fat=22.0,
                fiber=9.3,
                sodium=766.0,
                sugar=16.6,
            ),
            "explanations": ["Default baseline targets applied (no profile provided)."],
        }

    # Extract user stats with sensible fallbacks
    age = getattr(profile, "age", None) or 30
    sex = getattr(profile, "sex", None) or "other"
    weight_kg = getattr(profile, "weight_kg", None) or 68.0
    height_cm = getattr(profile, "height_cm", None) or 168.0
    activity = getattr(profile, "activity_level", None) or "sedentary"
    goal = getattr(profile, "goal", None) or "maintain"
    rate = getattr(profile, "target_rate_kg_per_week", None) or 0.5
    meals_per_day = max(1, getattr(profile, "meals_per_day", None) or 3)

    # Medical conditions & goals
    conditions = [c.lower() for c in (getattr(profile, "medical_conditions", None) or [])]
    is_diabetic = "diabetes_t1" in conditions or "diabetes_t2" in conditions or profile.goals.diabetic
    is_prediabetic = "prediabetes" in conditions
    is_hypertensive = "hypertension" in conditions
    is_kidney = "kidney" in conditions
    is_high_protein = profile.goals.protein

    # 1. BMR & TDEE
    bmr = calculate_bmr(weight_kg, height_cm, age, sex)
    tdee = calculate_tdee(bmr, activity)

    # 2. Calories
    daily_kcal, explanations = calculate_daily_calories(tdee, goal, rate, sex, age)

    # If profile has an explicit daily_kcal_target, respect it unless missing
    if profile.daily_kcal_target and profile.daily_kcal_target > 500:
        daily_kcal = float(profile.daily_kcal_target)
        explanations.append(f"Using profile-specified daily target: {round(daily_kcal)} kcal.")

    # 3. Macro split
    dist = STANDARDS["macro_distributions"]
    if is_diabetic:
        split = dist["diabetic"]
        explanations.append("Applied diabetic AMDR macro ratio: reduced carbs, increased protein & healthy fat.")
    elif is_prediabetic:
        split = dist["prediabetic"]
        explanations.append("Applied prediabetic AMDR macro ratio: balanced low-glycemic distribution.")
    elif is_high_protein:
        split = dist["high_protein"]
        explanations.append("Applied high-protein ratio for muscle retention and satiety.")
    else:
        split = dist["default"]

    carbs_kcal = daily_kcal * split["carbs_pct"]
    protein_kcal = daily_kcal * split["protein_pct"]
    fat_kcal = daily_kcal * split["fat_pct"]

    carbs_g = round(carbs_kcal / 4.0, 1)
    protein_g = round(protein_kcal / 4.0, 1)
    fat_g = round(fat_kcal / 9.0, 1)

    # Kidney adjustment: protein restriction
    if is_kidney:
        kidney_limit_g = round(weight_kg * STANDARDS["kidney_protein_limit_g_per_kg"], 1)
        if protein_g > kidney_limit_g:
            protein_g = kidney_limit_g
            explanations.append(
                f"Renal precaution: Protein intake capped at {kidney_limit_g}g ({STANDARDS['kidney_protein_limit_g_per_kg']}g/kg) "
                "to reduce renal workload. Please consult your physician."
            )

    # 4. Micronutrients (Fiber, Sodium, Sugar)
    fiber_cfg = STANDARDS["fiber_standards"]
    if age < 14:
        # Pediatric fiber: age + 5g or kcal proportion
        fiber_g = round(min(age + fiber_cfg["pediatric_age_addition"], (daily_kcal / 1000.0) * fiber_cfg["per_1000_kcal_grams"]), 1)
        explanations.append(f"Pediatric fiber rule applied for age {age}: target scaled to {fiber_g}g.")
    else:
        base_fiber = (daily_kcal / 1000.0) * fiber_cfg["per_1000_kcal_grams"]
        if is_diabetic or is_prediabetic:
            fiber_g = round(max(fiber_cfg["diabetic_minimum_grams"], base_fiber), 1)
            explanations.append(f"Diabetic fiber target set to {fiber_g}g to assist postprandial glucose control.")
        else:
            fiber_g = round(base_fiber, 1)

    # Sodium
    sod_cfg = STANDARDS["sodium_limits_mg"]
    if is_hypertensive or is_kidney:
        sodium_mg = sod_cfg["hypertension"]
        explanations.append("Hypertension/Renal sodium ceiling applied: 1500 mg/day (AHA guideline).")
    elif age < 8:
        sodium_mg = sod_cfg["pediatric_under_8"]
        explanations.append("Pediatric sodium ceiling applied: 1200 mg/day.")
    elif age < 14:
        sodium_mg = sod_cfg["pediatric_8_to_13"]
    else:
        sodium_mg = sod_cfg["standard_adult"]

    # Sugar
    sugar_cfg = STANDARDS["sugar_limits"]
    sugar_pct = sugar_cfg["diabetic_max_calorie_pct"] if (is_diabetic or is_prediabetic) else sugar_cfg["standard_max_calorie_pct"]
    sugar_g = round((daily_kcal * sugar_pct) / sugar_cfg["kcal_per_gram"], 1)

    daily = MacroTargets(
        kcal=daily_kcal,
        protein=protein_g,
        carbs=carbs_g,
        fat=fat_g,
        fiber=fiber_g,
        sodium=sodium_mg,
        sugar=sugar_g,
    )

    per_meal = MacroTargets(
        kcal=round(daily_kcal / meals_per_day, 1),
        protein=round(protein_g / meals_per_day, 1),
        carbs=round(carbs_g / meals_per_day, 1),
        fat=round(fat_g / meals_per_day, 1),
        fiber=round(fiber_g / meals_per_day, 1),
        sodium=round(sodium_mg / meals_per_day, 1),
        sugar=round(sugar_g / meals_per_day, 1),
    )

    return {
        "daily": daily,
        "per_meal": per_meal,
        "explanations": explanations,
    }


def resolve_daily_kcal_target(profile: UserProfile | None) -> float:
    """Return effective daily kcal target for a profile."""
    if profile is None:
        return DAILY_KCAL_TARGET_DEFAULT
    if profile.daily_kcal_target and profile.daily_kcal_target > 0:
        return float(profile.daily_kcal_target)
    targets = calculate_targets(profile)
    return float(targets["daily"].kcal)
