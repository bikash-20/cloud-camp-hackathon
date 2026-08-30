import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Edit3, Minus, Plus, RotateCcw } from 'lucide-react';
import { T } from '../../data';
import type {
  Allergen,
  DietaryPreference,
  HealthGoals,
  UserProfile,
} from '../../types/schemas';
import { getProfile, updateProfile } from '../../lib/api';
import Pill from '../Pill';
import Chip from '../Chip';
import SectionLabel from '../SectionLabel';

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
  'Peanuts', 'Tree nuts', 'Tree shellfish' as Allergen, 'Soy', 'Eggs', 'Dairy', 'Gluten', 'Sesame',
];

const toggleIn = (setState: React.Dispatch<React.SetStateAction<Record<string, boolean>>>) =>
  (k: string) => setState((s) => ({ ...s, [k]: !s[k] }));

interface ProfileScreenProps {
  profile: UserProfile;
  onProfileChange?: (p: UserProfile) => void;
}

export default function ProfileScreen({ profile, onProfileChange }: ProfileScreenProps) {
  const [goals, setGoals] = useState<HealthGoals>(profile.goals);
  const [prefs, setPrefs] = useState<Record<string, boolean>>(
    Object.fromEntries(profile.preferences.map((p) => [p, true])),
  );
  const [allergens, setAllergens] = useState<Record<string, boolean>>(
    Object.fromEntries(profile.allergens.map((a) => [a, true])),
  );
  const [budget, setBudget] = useState(profile.budget);
  const [serving, setServing] = useState(profile.serving);
  const [toast, setToast] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(profile.name);
  const syncedRef = useRef(false);

  // When parent profile changes (e.g. api loaded something new), re-sync local state
  useEffect(() => {
    if (!syncedRef.current) {
      setGoals(profile.goals);
      setBudget(profile.budget);
      setServing(profile.serving);
      setName(profile.name);
      syncedRef.current = true;
    }
  }, [profile]);

  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  const adjustBudget = (delta: number) => {
    setBudget((b) => Math.min(2000, Math.max(100, b + delta)));
  };

  const adjustServing = (delta: number) => {
    setServing((s) => Math.min(8, Math.max(1, s + delta)));
  };

  const resetAll = async () => {
    const fresh = await getProfile();
    setGoals(fresh.goals);
    setBudget(fresh.budget);
    setServing(fresh.serving);
    setName(fresh.name);
    setPrefs({});
    setAllergens({ Peanuts: true });
    await updateProfile(fresh);
    onProfileChange?.(fresh);
    triggerToast('Profile reset to defaults');
  };

  // Persist any meaningful change to the (mock) backend
  useEffect(() => {
    if (!syncedRef.current) return;
    const next: UserProfile = {
      name,
      goals,
      preferences: PREFS.filter((p) => prefs[p]),
      allergens: ALLERGENS.filter((a) => allergens[a]),
      budget,
      serving,
    };
    updateProfile(next).then((saved) => onProfileChange?.(saved));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goals, prefs, allergens, budget, serving, name]);

  const commitName = () => {
    setEditingName(false);
    if (name.trim() && name !== profile.name) {
      triggerToast(`Welcome, ${name}`);
    }
  };

  return (
    <div style={{ padding: '20px 24px 0' }}>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
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
        <motion.button
          type="button"
          onClick={resetAll}
          whileHover={{ y: -1, scale: 1.05 }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 380, damping: 22 }}
          aria-label="Reset profile to defaults"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            background: 'none',
            border: 'none',
            padding: '4px 6px',
            fontFamily: 'Inter',
            fontSize: 11,
            fontWeight: 600,
            color: T.inkSoft,
            cursor: 'pointer',
            minHeight: 28,
          }}
        >
          <RotateCcw size={11} /> Reset
        </motion.button>
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

      <SectionLabel>Health goals</SectionLabel>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
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

      <SectionLabel>Dietary preferences</SectionLabel>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.16 }}
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

      <SectionLabel>Allergens to avoid</SectionLabel>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.22 }}
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

      <SectionLabel>Daily grocery budget</SectionLabel>
      <StepperRow
        label="Budget"
        valueLabel={`৳${budget}`}
        onDec={() => adjustBudget(-50)}
        onInc={() => adjustBudget(50)}
        decLabel="Decrease budget by 50 taka"
        incLabel="Increase budget by 50 taka"
        hint="per day, used to rank grocery-list swaps"
      />

      <div style={{ marginTop: 16 }}>
        <SectionLabel>Servings on this plate</SectionLabel>
        <StepperRow
          label="Servings"
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
              position: 'absolute',
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
              zIndex: 5,
            }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface StepperRowProps {
  label: string;
  valueLabel: string;
  onDec: () => void;
  onInc: () => void;
  decLabel: string;
  incLabel: string;
  hint: string;
}

function StepperRow({ label: _label, valueLabel, onDec, onInc, decLabel, incLabel, hint }: StepperRowProps) {
  const reduceMotion = useReducedMotion();
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.28 }}
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
  );
}