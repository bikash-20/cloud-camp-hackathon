import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Edit3, LogOut, Minus, Plus, RotateCcw, Zap } from 'lucide-react';
import { T } from '../../data';
import type {
  ActivityLevel,
  Allergen,
  AuthSession,
  DietType,
  DietaryPreference,
  GoalType,
  HealthGoals,
  HeightUnit,
  MedicalCondition,
  Sex,
  UserProfile,
  UserStats,
  WeightUnit,
} from '../../types/schemas';
import { DAILY_KCAL_TARGET_DEFAULT } from '../../types/schemas';
import { DEFAULT_PROFILE, updateProfile, getUserStats } from '../../lib/api';
import { logout } from '../../lib/auth';
import { LocalizedContent } from '../../i18n/LanguageContext';
import { cmToFtIn, ftInToCm, kgToLb, lbToKg } from '../../lib/units';
import { calculateBiometricsBreakdown } from '../../lib/personalize';
import Pill from '../Pill';
import Chip from '../Chip';
import SectionLabel from '../SectionLabel';
import ThemeToggle from '../ThemeToggle';

interface GoalConfig {
  key: keyof HealthGoals;
  label: string;
  tone?: 'accent' | 'warning';
}

const GOALS: GoalConfig[] = [
  { key: 'diabetic', label: 'Prediabetic-friendly', tone: 'warning' },
  { key: 'protein', label: 'High-protein' },
  { key: 'budget', label: 'Budget-aware' },
  { key: 'mediter', label: 'Mediterranean' },
];

const PREFS: DietaryPreference[] = [
  'Vegetarian', 'Vegan', 'Pescatarian', 'Gluten-free', 'Dairy-free', 'Halal', 'Kosher',
];

const ALLERGENS: Allergen[] = [
  'Peanuts', 'Tree nuts', 'Shellfish', 'Soy', 'Eggs', 'Dairy', 'Gluten', 'Sesame',
];

const SEX_OPTIONS: Array<{ key: Sex; label: string }> = [
  { key: 'male', label: 'Male' },
  { key: 'female', label: 'Female' },
  { key: 'other', label: 'Other' },
];

const ACTIVITY_LEVELS: Array<{ key: ActivityLevel; label: string; desc: string }> = [
  { key: 'sedentary', label: 'Sedentary', desc: '1.2×' },
  { key: 'light', label: 'Light', desc: '1.375×' },
  { key: 'moderate', label: 'Moderate', desc: '1.55×' },
  { key: 'active', label: 'Active', desc: '1.725×' },
  { key: 'very_active', label: 'Very active', desc: '1.9×' },
];

const PRIMARY_GOALS: Array<{ key: GoalType; label: string }> = [
  { key: 'maintain', label: 'Maintain weight' },
  { key: 'lose', label: 'Lose weight' },
  { key: 'gain', label: 'Gain weight' },
];

const TARGET_RATES = [
  { value: 0.25, label: '0.25 kg/wk' },
  { value: 0.5, label: '0.5 kg/wk' },
  { value: 0.75, label: '0.75 kg/wk' },
  { value: 1.0, label: '1.0 kg/wk' },
];

const MEDICAL_CONDITIONS: Array<{ key: MedicalCondition; label: string }> = [
  { key: 'none', label: 'None' },
  { key: 'prediabetes', label: 'Prediabetes' },
  { key: 'diabetes_t2', label: 'Type 2 Diabetes' },
  { key: 'diabetes_t1', label: 'Type 1 Diabetes' },
  { key: 'hypertension', label: 'Hypertension' },
  { key: 'high_cholesterol', label: 'High Cholesterol' },
  { key: 'kidney', label: 'Kidney' },
];

const DIET_TYPES: Array<{ key: DietType; label: string }> = [
  { key: 'halal', label: 'Halal' },
  { key: 'omnivore', label: 'Omnivore' },
  { key: 'vegetarian', label: 'Vegetarian' },
  { key: 'vegan', label: 'Vegan' },
  { key: 'pescatarian', label: 'Pescatarian' },
  { key: 'kosher', label: 'Kosher' },
];

const toggleIn = (setState: React.Dispatch<React.SetStateAction<Record<string, boolean>>>) =>
  (k: string) => setState((s) => ({ ...s, [k]: !s[k] }));

interface ProfileScreenProps {
  profile: UserProfile;
  onProfileChange?: (p: UserProfile) => void;
  session?: AuthSession;
  onSignOut?: () => void;
}

export default function ProfileScreen({ profile, onProfileChange, session, onSignOut }: ProfileScreenProps) {
  // Biometrics & demographics state
  const [sex, setSex] = useState<Sex>(profile.sex ?? 'male');
  const [age, setAge] = useState<number>(profile.age ?? 28);
  const [heightCm, setHeightCm] = useState<number>(profile.heightCm ?? 172);
  const [weightKg, setWeightKg] = useState<number>(profile.weightKg ?? 70);
  const [heightUnit, setHeightUnit] = useState<HeightUnit>(profile.heightUnit ?? 'cm');
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(profile.weightUnit ?? 'kg');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(profile.activityLevel ?? 'moderate');
  const [goal, setGoal] = useState<GoalType>(profile.goal ?? 'maintain');
  const [targetRate, setTargetRate] = useState<number>(profile.targetRateKgPerWeek ?? 0.5);
  const [dietType, setDietType] = useState<DietType>(profile.dietType ?? 'halal');
  const [medicalConditions, setMedicalConditions] = useState<MedicalCondition[]>(
    profile.medicalConditions && profile.medicalConditions.length > 0 ? profile.medicalConditions : ['none'],
  );
  const [mealsPerDay, setMealsPerDay] = useState<number>(profile.mealsPerDay ?? 3);

  // Health goals & preferences
  const [goals, setGoals] = useState<HealthGoals>(profile.goals);
  const [prefs, setPrefs] = useState<Record<string, boolean>>(
    Object.fromEntries(profile.preferences.map((p) => [p, true])),
  );
  const [allergens, setAllergens] = useState<Record<string, boolean>>(
    Object.fromEntries(
      profile.allergens.map((allergen) => [
        allergen === 'Shell shellfish' ? 'Shellfish' : allergen,
        true,
      ]),
    ),
  );
  const [budget, setBudget] = useState(profile.budget);
  const [serving, setServing] = useState(profile.serving);
  const [dailyKcalTarget, setDailyKcalTarget] = useState<number>(
    typeof profile.dailyKcalTarget === 'number' && profile.dailyKcalTarget > 0
      ? profile.dailyKcalTarget
      : DAILY_KCAL_TARGET_DEFAULT,
  );
  const [toast, setToast] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(profile.name);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const statsLoadedRef = useRef(false);

  const prevRef = useRef({
    goals: profile.goals,
    budget: profile.budget,
    serving: profile.serving,
    name: profile.name,
    dailyKcalTarget,
    sex: profile.sex,
    age: profile.age,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    heightUnit: profile.heightUnit,
    weightUnit: profile.weightUnit,
    activityLevel: profile.activityLevel,
    goal: profile.goal,
    targetRate: profile.targetRateKgPerWeek,
    dietType: profile.dietType,
    medicalConditions: profile.medicalConditions,
    mealsPerDay: profile.mealsPerDay,
  });

  // Dynamic BMR, TDEE, and safe recommendation breakdown
  const breakdown = useMemo(() => {
    return calculateBiometricsBreakdown({
      age,
      sex,
      heightCm,
      weightKg,
      activityLevel,
      goal,
      targetRateKgPerWeek: targetRate,
    });
  }, [age, sex, heightCm, weightKg, activityLevel, goal, targetRate]);

  useEffect(() => {
    const prev = prevRef.current;
    if (profile.goals !== prev.goals) {
      setGoals(profile.goals);
      prev.goals = profile.goals;
    }
    if (profile.budget !== prev.budget) {
      setBudget(profile.budget);
      prev.budget = profile.budget;
    }
    if (profile.serving !== prev.serving) {
      setServing(profile.serving);
      prev.serving = profile.serving;
    }
    if (profile.name !== prev.name) {
      setName(profile.name);
      prev.name = profile.name;
    }
    if (profile.sex && profile.sex !== prev.sex) {
      setSex(profile.sex);
      prev.sex = profile.sex;
    }
    if (typeof profile.age === 'number' && profile.age !== prev.age) {
      setAge(profile.age);
      prev.age = profile.age;
    }
    if (typeof profile.heightCm === 'number' && profile.heightCm !== prev.heightCm) {
      setHeightCm(profile.heightCm);
      prev.heightCm = profile.heightCm;
    }
    if (typeof profile.weightKg === 'number' && profile.weightKg !== prev.weightKg) {
      setWeightKg(profile.weightKg);
      prev.weightKg = profile.weightKg;
    }
    if (profile.heightUnit && profile.heightUnit !== prev.heightUnit) {
      setHeightUnit(profile.heightUnit);
      prev.heightUnit = profile.heightUnit;
    }
    if (profile.weightUnit && profile.weightUnit !== prev.weightUnit) {
      setWeightUnit(profile.weightUnit);
      prev.weightUnit = profile.weightUnit;
    }
    if (profile.activityLevel && profile.activityLevel !== prev.activityLevel) {
      setActivityLevel(profile.activityLevel);
      prev.activityLevel = profile.activityLevel;
    }
    if (profile.goal && profile.goal !== prev.goal) {
      setGoal(profile.goal);
      prev.goal = profile.goal;
    }
    if (typeof profile.targetRateKgPerWeek === 'number' && profile.targetRateKgPerWeek !== prev.targetRate) {
      setTargetRate(profile.targetRateKgPerWeek);
      prev.targetRate = profile.targetRateKgPerWeek;
    }
    if (profile.dietType && profile.dietType !== prev.dietType) {
      setDietType(profile.dietType);
      prev.dietType = profile.dietType;
    }
    if (profile.medicalConditions && profile.medicalConditions !== prev.medicalConditions) {
      setMedicalConditions(profile.medicalConditions);
      prev.medicalConditions = profile.medicalConditions;
    }
    if (typeof profile.mealsPerDay === 'number' && profile.mealsPerDay !== prev.mealsPerDay) {
      setMealsPerDay(profile.mealsPerDay);
      prev.mealsPerDay = profile.mealsPerDay;
    }
    if (profile.dailyKcalTarget !== prev.dailyKcalTarget) {
      setDailyKcalTarget(
        typeof profile.dailyKcalTarget === 'number' && profile.dailyKcalTarget > 0
          ? profile.dailyKcalTarget
          : DAILY_KCAL_TARGET_DEFAULT,
      );
      prev.dailyKcalTarget = typeof profile.dailyKcalTarget === 'number' && profile.dailyKcalTarget > 0
        ? profile.dailyKcalTarget
        : DAILY_KCAL_TARGET_DEFAULT;
    }
  }, [profile]);

  useEffect(() => {
    if (statsLoadedRef.current) return;
    statsLoadedRef.current = true;
    let cancelled = false;
    getUserStats().then((s) => {
      if (!cancelled) {
        setStats(s);
        setStatsLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const adjustBudget = (delta: number) => {
    setBudget((b) => Math.min(2000, Math.max(100, b + delta)));
  };

  const adjustServing = (delta: number) => {
    setServing((s) => Math.min(8, Math.max(1, s + delta)));
  };

  const adjustDailyKcal = (delta: number) => {
    setDailyKcalTarget((v) => Math.min(4000, Math.max(1000, v + delta)));
  };

  const toggleCondition = (cond: MedicalCondition) => {
    if (cond === 'none') {
      setMedicalConditions(['none']);
      return;
    }
    setMedicalConditions((current) => {
      const withoutNone = current.filter((c) => c !== 'none');
      const exists = withoutNone.includes(cond);
      const updated = exists ? withoutNone.filter((c) => c !== cond) : [...withoutNone, cond];
      return updated.length === 0 ? ['none'] : updated;
    });
  };

  const resetAll = async () => {
    const fresh = structuredClone(DEFAULT_PROFILE);
    setGoals(fresh.goals);
    setBudget(fresh.budget);
    setServing(fresh.serving);
    setName(fresh.name);
    setDailyKcalTarget(DAILY_KCAL_TARGET_DEFAULT);
    setPrefs({});
    setAllergens({ Peanuts: true });
    setSex(fresh.sex ?? 'male');
    setAge(fresh.age ?? 28);
    setHeightCm(fresh.heightCm ?? 172);
    setWeightKg(fresh.weightKg ?? 70);
    setHeightUnit(fresh.heightUnit ?? 'cm');
    setWeightUnit(fresh.weightUnit ?? 'kg');
    setActivityLevel(fresh.activityLevel ?? 'moderate');
    setGoal(fresh.goal ?? 'maintain');
    setTargetRate(fresh.targetRateKgPerWeek ?? 0.5);
    setDietType(fresh.dietType ?? 'halal');
    setMedicalConditions(fresh.medicalConditions ?? ['none']);
    setMealsPerDay(fresh.mealsPerDay ?? 3);
    await updateProfile(fresh);
    onProfileChange?.(fresh);
    triggerToast('Profile reset to defaults');
  };

  // Persist all fields to storage/API
  useEffect(() => {
    const next: UserProfile = {
      name,
      age,
      sex,
      heightCm,
      weightKg,
      heightUnit,
      weightUnit,
      activityLevel,
      goal,
      targetRateKgPerWeek: targetRate,
      dietType,
      medicalConditions,
      mealsPerDay,
      goals,
      preferences: PREFS.filter((p) => prefs[p]),
      allergens: ALLERGENS.filter((a) => allergens[a]),
      budget,
      serving,
      dailyKcalTarget,
    };
    updateProfile(next).then((saved) => onProfileChange?.(saved));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    name,
    age,
    sex,
    heightCm,
    weightKg,
    heightUnit,
    weightUnit,
    activityLevel,
    goal,
    targetRate,
    dietType,
    medicalConditions,
    mealsPerDay,
    goals,
    prefs,
    allergens,
    budget,
    serving,
    dailyKcalTarget,
  ]);

  const commitName = () => {
    setEditingName(false);
    if (name.trim() && name !== profile.name) {
      triggerToast(`Welcome, ${name}`);
    }
  };

  const handleSignOut = () => {
    logout();
    onSignOut?.();
  };

  // Height display & step helpers
  const { feet: heightFeet, inches: heightInches } = cmToFtIn(heightCm);
  const heightDisplay = heightUnit === 'cm'
    ? `${heightCm} cm`
    : `${heightFeet} ft ${heightInches} in`;

  const adjustHeight = (delta: number) => {
    if (heightUnit === 'cm') {
      setHeightCm((h) => Math.min(250, Math.max(50, h + delta)));
    } else {
      const nextCm = ftInToCm(heightFeet, heightInches + delta);
      setHeightCm(Math.min(250, Math.max(50, nextCm)));
    }
  };

  // Weight display & step helpers
  const weightDisplay = weightUnit === 'kg'
    ? `${weightKg.toFixed(1)} kg`
    : `${kgToLb(weightKg).toFixed(1)} lb`;

  const adjustWeight = (delta: number) => {
    if (weightUnit === 'kg') {
      setWeightKg((w) => Math.min(300, Math.max(15, Math.round((w + delta * 0.5) * 10) / 10)));
    } else {
      const curLb = kgToLb(weightKg);
      const nextKg = lbToKg(curLb + delta);
      setWeightKg(Math.min(300, Math.max(15, nextKg)));
    }
  };

  return (
    <LocalizedContent>
    <div style={{ padding: '20px var(--screen-gutter, 24px) 40px' }}>
      {session && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="glass-soft profile-signed-in"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 10px',
            borderRadius: 999,
            marginBottom: 10,
            fontFamily: 'Inter',
            fontSize: 11,
            fontWeight: 600,
            color: T.inkSoft,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: T.accentGood,
            }}
          />
          Signed in as {session.email}
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="profile-heading-row"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <h2
          style={{
            fontFamily: 'Inter',
            fontSize: 24,
            fontWeight: 600,
            color: T.ink,
            letterSpacing: '-0.02em',
          }}
        >
          Your health profile
        </h2>
        <div className="profile-heading-actions" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <ThemeToggle />
          <motion.button
            type="button"
            onClick={resetAll}
            whileHover={{ y: -1, scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 22 }}
            aria-label="Reset profile to defaults"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 10px',
              borderRadius: 10,
              background: 'rgba(74, 58, 52, 0.08)',
              border: '1px solid rgba(74, 58, 52, 0.18)',
              fontFamily: 'Inter',
              fontSize: 11,
              fontWeight: 700,
              color: T.ink,
              cursor: 'pointer',
              minHeight: 28,
            }}
          >
            <RotateCcw size={12} strokeWidth={2.5} /> Reset
          </motion.button>
          {onSignOut && (
            <motion.button
              type="button"
              onClick={handleSignOut}
              whileHover={{ y: -1, scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22 }}
              aria-label="Sign out of NutriVision"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 10px',
                borderRadius: 10,
                background: T.accentWarn,
                border: `1px solid ${T.accentWarn}`,
                color: '#FFFFFF',
                fontFamily: 'Inter',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                minHeight: 28,
                boxShadow: '0 4px 12px -4px rgba(201, 98, 45, 0.55)',
              }}
            >
              <LogOut size={12} strokeWidth={2.5} /> Sign out
            </motion.button>
          )}
        </div>
      </motion.div>

      <p
        style={{
          fontFamily: 'Inter',
          fontSize: 13,
          color: T.inkSoft,
          margin: '4px 0 20px',
          lineHeight: 1.4,
        }}
      >
        Hi {name} — these shape every flag and swap you see.
      </p>

      {/* Profile Header Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.05 }}
        className="glass-card"
        style={{
          borderRadius: 18,
          padding: '14px 16px',
          marginBottom: 22,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <motion.button
            type="button"
            onClick={() => setEditingName((v) => !v)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 380, damping: 22 }}
            aria-label="Edit profile name"
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: T.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow:
                '0 6px 14px -4px rgba(46, 37, 34, 0.45), inset 0 1.5px 0 rgba(255,255,255,0.35)',
              fontFamily: 'Inter',
              fontWeight: 700,
              fontSize: 14,
              color: '#FFFFFF',
              cursor: 'pointer',
              border: 'none',
              flexShrink: 0,
              padding: 0,
            }}
          >
            {name
              .split(' ')
              .map((p) => p[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()}
          </motion.button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <AnimatePresence mode="wait" initial={false}>
              {editingName ? (
                <motion.input
                  key="edit"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={commitName}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitName();
                    if (e.key === 'Escape') {
                      setName(profile.name);
                      setEditingName(false);
                    }
                  }}
                  aria-label="Profile name"
                  style={{
                    width: '100%',
                    fontFamily: 'Inter',
                    fontSize: 14,
                    fontWeight: 600,
                    color: T.ink,
                    background: 'rgba(249, 242, 228, 0.7)',
                    border: `1px solid ${T.primary}`,
                    borderRadius: 8,
                    padding: '4px 8px',
                    outline: 'none',
                  }}
                />
              ) : (
                <motion.div
                  key="text"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontFamily: 'Inter',
                    fontWeight: 600,
                    fontSize: 14,
                    color: T.ink,
                  }}
                >
                  <span>{name}</span>
                  <Edit3
                    size={11}
                    color={T.inkSoft}
                    style={{ opacity: 0.6 }}
                    aria-hidden="true"
                  />
                </motion.div>
              )}
            </AnimatePresence>
            <div
              style={{
                fontFamily: 'Inter',
                fontSize: 12,
                color: T.inkSoft,
                marginTop: 2,
              }}
            >
              Dhaka, Bangladesh · {serving > 1 ? `${serving} servings` : '12-day streak'}
            </div>
          </div>
        </div>
      </motion.div>

      {/* User Stats Card */}
      {!statsLoading && stats && stats.totalMeals > 0 && (
        <>
          <SectionLabel>Your Stats</SectionLabel>
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08 }}
            className="glass-card"
            style={{
              borderRadius: 18,
              padding: '14px 16px',
              marginBottom: 22,
              display: 'flex',
              gap: 16,
            }}
          >
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div className="tnum" style={{ fontFamily: 'Inter', fontSize: 20, fontWeight: 700, color: T.ink }}>
                {stats.totalMeals}
              </div>
              <div style={{ fontFamily: 'Inter', fontSize: 11, color: T.inkSoft }}>
                meals logged
              </div>
            </div>
            <div style={{ width: 1, background: T.cardBorder, alignSelf: 'stretch' }} />
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div className="tnum" style={{ fontFamily: 'Inter', fontSize: 20, fontWeight: 700, color: T.ink }}>
                {stats.totalDaysActive}
              </div>
              <div style={{ fontFamily: 'Inter', fontSize: 11, color: T.inkSoft }}>
                days active
              </div>
            </div>
            <div style={{ width: 1, background: T.cardBorder, alignSelf: 'stretch' }} />
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div className="tnum" style={{ fontFamily: 'Inter', fontSize: 20, fontWeight: 700, color: T.accentAmber }}>
                {stats.avgDailyKcal}
              </div>
              <div style={{ fontFamily: 'Inter', fontSize: 11, color: T.inkSoft }}>
                avg kcal/day
              </div>
            </div>
          </motion.div>
        </>
      )}

      {/* ── 1. Biological Sex ─────────────────────────────────── */}
      <SectionLabel>Biological Sex</SectionLabel>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.08 }}
        style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}
      >
        {SEX_OPTIONS.map((opt) => (
          <Pill
            key={opt.key}
            layoutId={`sex-${opt.key}`}
            active={sex === opt.key}
            onClick={() => setSex(opt.key)}
            ariaLabel={`Select ${opt.label}`}
          >
            {opt.label}
          </Pill>
        ))}
      </motion.div>

      {/* ── 2. Age ────────────────────────────────────────────── */}
      <SectionLabel>Age</SectionLabel>
      <StepperRow
        valueLabel={`${age} years`}
        onDec={() => setAge((a) => Math.max(1, a - 1))}
        onInc={() => setAge((a) => Math.min(100, a + 1))}
        decLabel="Decrease age by 1 year"
        incLabel="Increase age by 1 year"
        hint="Used for Mifflin-St Jeor BMR calculation and pediatric safety rules"
      />

      {/* ── 3. Height (with cm / ft-in toggle) ─────────────────── */}
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <SectionLabel>Height</SectionLabel>
          <div style={{ display: 'inline-flex', gap: 4 }}>
            <button
              type="button"
              onClick={() => setHeightUnit('cm')}
              style={{
                fontSize: 11,
                fontFamily: 'Inter',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                background: heightUnit === 'cm' ? T.primary : 'rgba(74, 58, 52, 0.08)',
                color: heightUnit === 'cm' ? '#FFFFFF' : T.inkSoft,
              }}
            >
              cm
            </button>
            <button
              type="button"
              onClick={() => setHeightUnit('ft_in')}
              style={{
                fontSize: 11,
                fontFamily: 'Inter',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                background: heightUnit === 'ft_in' ? T.primary : 'rgba(74, 58, 52, 0.08)',
                color: heightUnit === 'ft_in' ? '#FFFFFF' : T.inkSoft,
              }}
            >
              ft · in
            </button>
          </div>
        </div>
        <StepperRow
          valueLabel={heightDisplay}
          onDec={() => adjustHeight(-1)}
          onInc={() => adjustHeight(1)}
          decLabel="Decrease height"
          incLabel="Increase height"
          hint={`Normalized: ${heightCm} cm — used to calculate BMR`}
        />
      </div>

      {/* ── 4. Weight (with kg / lb toggle) ───────────────────── */}
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <SectionLabel>Weight</SectionLabel>
          <div style={{ display: 'inline-flex', gap: 4 }}>
            <button
              type="button"
              onClick={() => setWeightUnit('kg')}
              style={{
                fontSize: 11,
                fontFamily: 'Inter',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                background: weightUnit === 'kg' ? T.primary : 'rgba(74, 58, 52, 0.08)',
                color: weightUnit === 'kg' ? '#FFFFFF' : T.inkSoft,
              }}
            >
              kg
            </button>
            <button
              type="button"
              onClick={() => setWeightUnit('lb')}
              style={{
                fontSize: 11,
                fontFamily: 'Inter',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                background: weightUnit === 'lb' ? T.primary : 'rgba(74, 58, 52, 0.08)',
                color: weightUnit === 'lb' ? '#FFFFFF' : T.inkSoft,
              }}
            >
              lb
            </button>
          </div>
        </div>
        <StepperRow
          valueLabel={weightDisplay}
          onDec={() => adjustWeight(-1)}
          onInc={() => adjustWeight(1)}
          decLabel="Decrease weight"
          incLabel="Increase weight"
          hint={`Normalized: ${weightKg.toFixed(1)} kg — used for daily caloric expenditure`}
        />
      </div>

      {/* ── 5. Activity Level ─────────────────────────────────── */}
      <div style={{ marginTop: 16 }}>
        <SectionLabel>Activity Level</SectionLabel>
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.12 }}
          style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}
        >
          {ACTIVITY_LEVELS.map((act) => (
            <Pill
              key={act.key}
              layoutId={`act-${act.key}`}
              active={activityLevel === act.key}
              onClick={() => setActivityLevel(act.key)}
              ariaLabel={`Select ${act.label} activity level`}
            >
              {act.label}
            </Pill>
          ))}
        </motion.div>
      </div>

      {/* ── 6. Primary Goal ───────────────────────────────────── */}
      <div style={{ marginTop: 16 }}>
        <SectionLabel>Primary Goal</SectionLabel>
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.14 }}
          style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}
        >
          {PRIMARY_GOALS.map((g) => (
            <Pill
              key={g.key}
              layoutId={`primary-goal-${g.key}`}
              active={goal === g.key}
              onClick={() => setGoal(g.key)}
              ariaLabel={`Select ${g.label}`}
            >
              {g.label}
            </Pill>
          ))}
        </motion.div>

        {goal !== 'maintain' && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: 'Inter', fontSize: 11, fontWeight: 600, color: T.inkSoft, marginBottom: 6 }}>
              Target rate (kg/wk)
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {TARGET_RATES.map((rate) => (
                <button
                  key={rate.value}
                  type="button"
                  onClick={() => setTargetRate(rate.value)}
                  style={{
                    fontSize: 11,
                    fontFamily: 'Inter',
                    fontWeight: 700,
                    padding: '5px 10px',
                    borderRadius: 8,
                    border: targetRate === rate.value ? `1px solid ${T.primary}` : '1px solid rgba(74, 58, 52, 0.15)',
                    background: targetRate === rate.value ? T.primary : 'rgba(249, 242, 228, 0.7)',
                    color: targetRate === rate.value ? '#FFFFFF' : T.ink,
                    cursor: 'pointer',
                  }}
                >
                  {rate.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── 7. Dynamic Metabolic Estimate Card ────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.16 }}
        className="glass-card"
        style={{
          borderRadius: 18,
          padding: '16px',
          marginTop: 18,
          marginBottom: 24,
          background: 'rgba(201, 98, 45, 0.05)',
          border: '1px solid rgba(201, 98, 45, 0.2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontFamily: 'Inter', fontSize: 13, fontWeight: 700, color: T.accentAmber }}>
            Metabolic Estimate (Mifflin-St Jeor)
          </span>
          <span style={{ fontFamily: 'Inter', fontSize: 11, fontWeight: 600, color: T.inkSoft }}>
            TDEE = BMR × Activity
          </span>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1, textAlign: 'center', padding: '10px 6px', borderRadius: 12, background: 'rgba(249, 242, 228, 0.7)' }}>
            <div className="tnum" style={{ fontFamily: 'Inter', fontSize: 18, fontWeight: 700, color: T.ink }}>
              {breakdown.bmr}
            </div>
            <div style={{ fontFamily: 'Inter', fontSize: 10, color: T.inkSoft, marginTop: 2 }}>
              Resting burn (BMR)
            </div>
          </div>
          <div style={{ flex: 1, textAlign: 'center', padding: '10px 6px', borderRadius: 12, background: 'rgba(249, 242, 228, 0.7)' }}>
            <div className="tnum" style={{ fontFamily: 'Inter', fontSize: 18, fontWeight: 700, color: T.accentAmber }}>
              {breakdown.tdee}
            </div>
            <div style={{ fontFamily: 'Inter', fontSize: 10, color: T.inkSoft, marginTop: 2 }}>
              Daily burn (TDEE)
            </div>
          </div>
          <div style={{ flex: 1, textAlign: 'center', padding: '10px 6px', borderRadius: 12, background: 'rgba(249, 242, 228, 0.7)' }}>
            <div className="tnum" style={{ fontFamily: 'Inter', fontSize: 18, fontWeight: 700, color: T.primary }}>
              {breakdown.recommendedKcal}
            </div>
            <div style={{ fontFamily: 'Inter', fontSize: 10, color: T.inkSoft, marginTop: 2 }}>
              Safe Target
            </div>
          </div>
        </div>

        <div style={{ fontFamily: 'Inter', fontSize: 11, color: T.inkSoft, marginBottom: 12, lineHeight: 1.45 }}>
          {breakdown.explanation}
        </div>

        <motion.button
          type="button"
          onClick={() => {
            setDailyKcalTarget(breakdown.recommendedKcal);
            triggerToast(`Daily target updated to ${breakdown.recommendedKcal} kcal`);
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          style={{
            width: '100%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '9px 14px',
            borderRadius: 12,
            background: T.primary,
            color: '#FFFFFF',
            fontFamily: 'Inter',
            fontSize: 12,
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 12px -2px rgba(46, 37, 34, 0.25)',
          }}
        >
          <Zap size={13} fill="#FFFFFF" />
          Apply calculated target ({breakdown.recommendedKcal} kcal)
        </motion.button>
      </motion.div>

      {/* ── 8. Medical Conditions ─────────────────────────────── */}
      <SectionLabel>Medical Conditions</SectionLabel>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.18 }}
        style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}
      >
        {MEDICAL_CONDITIONS.map((cond) => {
          const isActive = medicalConditions.includes(cond.key);
          return (
            <Chip
              key={cond.key}
              label={cond.label}
              active={isActive}
              onClick={() => toggleCondition(cond.key)}
            />
          );
        })}
      </motion.div>

      {/* ── 9. Diet Type ──────────────────────────────────────── */}
      <SectionLabel>Diet Type</SectionLabel>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}
      >
        {DIET_TYPES.map((d) => (
          <Pill
            key={d.key}
            layoutId={`diet-${d.key}`}
            active={dietType === d.key}
            onClick={() => setDietType(d.key)}
            ariaLabel={`Select ${d.label} diet`}
          >
            {d.label}
          </Pill>
        ))}
      </motion.div>

      {/* ── 10. Meals per day ─────────────────────────────────── */}
      <SectionLabel>Meals per day</SectionLabel>
      <StepperRow
        valueLabel={`${mealsPerDay} meals`}
        onDec={() => setMealsPerDay((m) => Math.max(1, m - 1))}
        onInc={() => setMealsPerDay((m) => Math.min(6, m + 1))}
        decLabel="Decrease meals per day"
        incLabel="Increase meals per day"
        hint="Divides daily calorie and glycemic budget across your meals"
      />

      {/* ── 11. Health Goals ──────────────────────────────────── */}
      <div style={{ marginTop: 20 }}>
        <SectionLabel>Health goals</SectionLabel>
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.22 }}
          style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}
        >
          {GOALS.map((g) => (
            <Pill
              key={g.key}
              layoutId={`goal-${g.key}`}
              active={!!goals[g.key]}
              onClick={() => setGoals((s) => ({ ...s, [g.key]: !s[g.key] }))}
              tone={g.tone}
              ariaLabel={`Toggle ${g.label} goal`}
            >
              {g.label}
            </Pill>
          ))}
        </motion.div>
      </div>

      {/* ── 12. Dietary Preferences ───────────────────────────── */}
      <SectionLabel>Dietary preferences</SectionLabel>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.24 }}
        style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}
      >
        {PREFS.map((p) => (
          <Chip
            key={p}
            label={p}
            active={!!prefs[p]}
            onClick={() => toggleIn(setPrefs)(p)}
          />
        ))}
      </motion.div>

      {/* ── 13. Allergens to Avoid ────────────────────────────── */}
      <SectionLabel>Allergens to avoid</SectionLabel>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.26 }}
        style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}
      >
        {ALLERGENS.map((a) => (
          <Chip
            key={a}
            label={a}
            active={!!allergens[a]}
            onClick={() => toggleIn(setAllergens)(a)}
          />
        ))}
      </motion.div>

      {/* ── 14. Daily kcal target ─────────────────────────────── */}
      <SectionLabel>Daily kcal target</SectionLabel>
      <StepperRow
        valueLabel={`${dailyKcalTarget} kcal`}
        onDec={() => adjustDailyKcal(-50)}
        onInc={() => adjustDailyKcal(50)}
        decLabel="Decrease daily kcal target by 50"
        incLabel="Increase daily kcal target by 50"
        hint="Powers the Home progress bar — can be set manually or via the calculator above"
      />

      {/* ── 15. Daily grocery budget ──────────────────────────── */}
      <div style={{ marginTop: 16 }}>
        <SectionLabel>Daily grocery budget</SectionLabel>
        <StepperRow
          valueLabel={`৳${budget}`}
          onDec={() => adjustBudget(-50)}
          onInc={() => adjustBudget(50)}
          decLabel="Decrease budget by 50 taka"
          incLabel="Increase budget by 50 taka"
          hint={`per day — the Grocery screen applies this as a weekly cap of ৳${budget * 7} (×7 days)`}
        />
      </div>

      {/* ── 16. Servings on this plate ────────────────────────── */}
      <div style={{ marginTop: 16 }}>
        <SectionLabel>Servings on this plate</SectionLabel>
        <StepperRow
          valueLabel={`${serving}×`}
          onDec={() => adjustServing(-1)}
          onInc={() => adjustServing(1)}
          decLabel="Decrease servings"
          incLabel="Increase servings"
          hint="used to scale macro values across Nutrients"
        />
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.22 }}
            role="status"
            aria-live="polite"
            style={{
              position: 'fixed',
              left: 24,
              right: 24,
              bottom: 110,
              padding: '10px 14px',
              borderRadius: 14,
              background: T.primary,
              color: '#FFFFFF',
              fontFamily: 'Inter',
              fontSize: 12,
              fontWeight: 600,
              textAlign: 'center',
              boxShadow: '0 8px 24px rgba(46, 37, 34, 0.25)',
              zIndex: 99,
            }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </LocalizedContent>
  );
}

interface StepperRowProps {
  valueLabel: string;
  onDec: () => void;
  onInc: () => void;
  decLabel: string;
  incLabel: string;
  hint: string;
}

function StepperRow({ valueLabel, onDec, onInc, decLabel, incLabel, hint }: StepperRowProps) {
  const reduceMotion = useReducedMotion();
  return (
    <LocalizedContent>
      <>
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="glass-card"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            borderRadius: 18,
            padding: '12px 16px',
          }}
        >
          <motion.button
            type="button"
            onClick={onDec}
            aria-label={decLabel}
            whileHover={!reduceMotion ? { scale: 1.08 } : {}}
            whileTap={!reduceMotion ? { scale: 0.88 } : {}}
            transition={{ type: 'spring', stiffness: 380, damping: 18 }}
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: '1px solid rgba(74, 58, 52, 0.15)',
              background: 'rgba(249, 242, 228, 0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
          >
            <Minus size={14} color={T.ink} strokeWidth={2.2} />
          </motion.button>

          <div
            style={{
              flex: 1,
              textAlign: 'center',
              fontFamily: "'Inter', sans-serif",
              fontSize: 18,
              fontWeight: 700,
              color: T.ink,
              overflow: 'hidden',
              minHeight: 28,
              position: 'relative',
            }}
            aria-live="polite"
            aria-atomic="true"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={valueLabel}
                initial={reduceMotion ? { opacity: 0 } : { y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { y: -8, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                style={{ display: 'inline-block' }}
                className="tnum"
              >
                {valueLabel}
              </motion.span>
            </AnimatePresence>
          </div>

          <motion.button
            type="button"
            onClick={onInc}
            aria-label={incLabel}
            whileHover={!reduceMotion ? { scale: 1.08 } : {}}
            whileTap={!reduceMotion ? { scale: 0.88 } : {}}
            transition={{ type: 'spring', stiffness: 380, damping: 18 }}
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: '1px solid rgba(74, 58, 52, 0.15)',
              background: 'rgba(249, 242, 228, 0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
          >
            <Plus size={14} color={T.ink} strokeWidth={2.2} />
          </motion.button>
        </motion.div>
        <div
          style={{
            fontFamily: 'Inter',
            fontSize: 11,
            color: T.inkSoft,
            marginTop: 6,
            textAlign: 'center',
          }}
        >
          {hint}
        </div>
      </>
    </LocalizedContent>
  );
}
