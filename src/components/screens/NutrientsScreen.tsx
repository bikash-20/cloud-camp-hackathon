import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { AlertTriangle, ChevronLeft, Info, Share2, Sparkles } from 'lucide-react';
import { T, NUTRITION_DB } from '../../data';
import { resolveNutrition } from '../../lib/api';
import { focusedNutrients, unitForNutrient, getEffectiveNutrition } from '../../lib/personalize';
import { MOCK_TARGETS } from '../../mocks/fixtures';
import type { DetectedItem, NutrientContribution, NutritionFacts, UserProfile } from '../../types/schemas';
import Bar from '../Bar';
import useCountUp from '../useCountUp';
import { LocalizedContent, useLanguage } from '../../i18n/LanguageContext';

interface MacroDonutProps {
  value: number;
  target: number;
  color: string;
  label: string;
  size?: number;
  stroke?: number;
  delay?: number;
}

function MacroDonut({ value, target, color, label, size = 88, stroke = 8, delay = 0 }: MacroDonutProps) {
  const reduceMotion = useReducedMotion();
  const { translate } = useLanguage();
  const pct = Math.min(100, Math.round((value / target) * 100));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const overTarget = value > target;
  return (
    <motion.div
      className="macro-donut"
      whileHover={{ y: -2, scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 380, damping: 22 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        flex: 1,
        width: '100%',
        minWidth: 0,
        padding: 4,
        borderRadius: 14,
        cursor: 'default',
      }}
    >
      <div
        className="macro-donut-ring"
        style={{
          position: 'relative',
          width: size,
          height: size,
          flexShrink: 0,
        }}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ transform: 'rotate(-90deg)' }}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="rgba(74, 58, 52, 0.10)"
            strokeWidth={stroke}
            fill="none"
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            animate={{ strokeDashoffset: c - (pct / 100) * c }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { type: 'spring', stiffness: 80, damping: 18, delay }
            }
            style={{
              filter: overTarget
                ? `drop-shadow(0 0 4px ${color}88)`
                : undefined,
            }}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1.1,
          }}
        >
          <div
            className="tnum"
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 18,
              fontWeight: 700,
              color: overTarget ? T.accentWarn : T.ink,
              transition: 'color 200ms ease',
            }}
          >
            {value}
            <span style={{ fontSize: 10, fontWeight: 500, color: T.inkSoft }}>
              g
            </span>
          </div>
          <div
            className="tnum"
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 10,
              fontWeight: 500,
              color: T.inkSoft,
              marginTop: 2,
            }}
          >
            {pct}%
          </div>
        </div>
      </div>
      <div
        style={{
          fontFamily: 'Inter',
          fontSize: 12,
          fontWeight: 600,
          color: T.ink,
        }}
      >
        {translate(label)}
      </div>
    </motion.div>
  );
}

interface ExplainabilityStripProps {
  contributions: NutrientContribution[];
  flaggedNutrients: ReadonlyArray<{ nutrient: 'sodium' | 'sugar' | 'fiber'; threshold: number; }>;
}

/** SHAP-style "Why these flags?" panel — shows contributing items per flagged nutrient. */
function ExplainabilityStrip({ contributions, flaggedNutrients }: ExplainabilityStripProps) {
  const { foodName } = useLanguage();
  const flagged = flaggedNutrients
    .map((f) => ({
      ...f,
      contributions: contributions
        .filter((c) => c.nutrient === f.nutrient)
        .sort((a, b) => b.share - a.share),
    }))
    .filter((f) => f.contributions.length > 0);

  if (flagged.length === 0) return null;

  return (
    <LocalizedContent>
      <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.42 }}
      className="explainability-strip glass-card"
      style={{
        borderRadius: 22,
        padding: '14px 16px',
        marginBottom: 18,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 10,
        }}
      >
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: T.primary,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Sparkles size={12} color="#FFFFFF" strokeWidth={2.4} />
        </span>
        <div
          style={{
            fontFamily: 'Inter',
            fontSize: 13,
            fontWeight: 600,
            color: T.ink,
          }}
        >
          Why these flags?
        </div>
        <div
          style={{
            marginLeft: 'auto',
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 9,
            fontWeight: 600,
            color: T.inkSoft,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            background: 'rgba(74, 58, 52, 0.08)',
            padding: '3px 6px',
            borderRadius: 6,
          }}
        >
          SHAP-style
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {flagged.map((f) => (
          <div key={f.nutrient}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                fontFamily: 'Inter',
                fontSize: 11,
                fontWeight: 600,
                color: T.inkSoft,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 6,
              }}
            >
              <span>{f.nutrient}</span>
              <span style={{ color: T.ink }}>
                {f.contributions.reduce((s, c) => s + c.amount, 0).toFixed(0)}
                {unitForNutrient(f.nutrient)} total
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {f.contributions.map((c) => (
                <div
                  key={`${f.nutrient}-${c.itemName}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      fontFamily: 'Inter',
                      fontSize: 11,
                      color: T.ink,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {foodName(c.itemName)}
                  </span>
                  <div
                    style={{
                      flex: 1.2,
                      height: 5,
                      borderRadius: 3,
                      background: 'rgba(74, 58, 52, 0.08)',
                      overflow: 'hidden',
                    }}
                  >
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${c.share * 100}%` }}
                      transition={{ type: 'spring', stiffness: 90, damping: 18, delay: 0.5 }}
                      style={{
                        height: '100%',
                        background: c.flagged ? T.accentWarn : T.primary,
                        borderRadius: 3,
                      }}
                    />
                  </div>
                  <span
                    className="tnum"
                    style={{
                      width: 42,
                      textAlign: 'right',
                      fontFamily: "'Inter', sans-serif",
                      fontSize: 10,
                      fontWeight: 600,
                      color: T.inkSoft,
                    }}
                  >
                    {Math.round(c.share * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      </motion.div>
    </LocalizedContent>
  );
}

/**
 * Verdict chips + one-sentence meal verdict.
 *
 * Per Blueprint §2 ("Explainability Layer — judges love transparency"),
 * this is the headline reasoning layer. Each chip is a short, item-specific
 * sentence that names the food, the nutrient, and the impact. The closing
 * "Meal verdict" ties the most-flagged items into one human-readable line.
 *
 * Tone:
 *   - 'warn' (accentWarn background) — over-target for the user's profile
 *   - 'good' (accentGood background) — under-target supportive call-out
 */
interface ItemVerdict {
  itemName: string;
  reason: string;
  nutrient: NutrientContribution['nutrient'];
  amount: number;
  tone: 'good' | 'warn';
  share: number; // for sorting the "top offender" pick
}

function buildItemVerdicts(contributions: NutrientContribution[]): ItemVerdict[] {
  // Pick the most-impactful verdict per item: prefer flagged, then highest share.
  const byItem = new Map<string, ItemVerdict>();
  for (const c of contributions) {
    if (!c.reason) continue;
    const existing = byItem.get(c.itemName);
    const candidate: ItemVerdict = {
      itemName: c.itemName,
      reason: c.reason,
      nutrient: c.nutrient,
      amount: c.amount,
      tone: c.tone ?? (c.flagged ? 'warn' : 'good'),
      share: c.share,
    };
    if (!existing) {
      byItem.set(c.itemName, candidate);
      continue;
    }
    // Prefer flagged, then by share
    const existingScore = (existing.tone === 'warn' ? 2 : 1) * 1000 + existing.share;
    const candidateScore = (candidate.tone === 'warn' ? 2 : 1) * 1000 + candidate.share;
    if (candidateScore > existingScore) byItem.set(c.itemName, candidate);
  }
  return Array.from(byItem.values()).sort((a, b) => {
    if (a.tone !== b.tone) return a.tone === 'warn' ? -1 : 1;
    return b.share - a.share;
  });
}

function buildMealVerdict(
  verdicts: ItemVerdict[],
  isDiabetic: boolean,
  language: 'en' | 'bn',
  foodName: (name: string) => string,
): string {
  if (verdicts.length === 0) {
    return language === 'bn'
      ? 'উল্লেখযোগ্য কোনো সতর্কতা নেই—এই খাবার আপনার সক্রিয় লক্ষ্যগুলোর সঙ্গে সামঞ্জস্যপূর্ণ।'
      : 'No major flags — this meal sits comfortably within your active goals.';
  }
  const topWarn = verdicts.filter((v) => v.tone === 'warn').slice(0, 2);
  if (topWarn.length === 0) {
    if (language === 'bn') {
      return isDiabetic
        ? 'ডায়াবেটিস-বান্ধব সীমা অতিক্রম করেনি—সক্রিয় লক্ষ্যের জন্য খাবারটি সুষম।'
        : 'সোডিয়াম বা আঁশের সীমা অতিক্রম করেনি—সব মিলিয়ে খাবারটি সুষম।';
    }
    return isDiabetic
      ? 'Nothing crossed your diabetic-friendly thresholds — well-balanced for the active goal.'
      : 'Nothing crossed your sodium or fiber thresholds — a balanced plate overall.';
  }
  const names = topWarn.map((v) => foodName(v.itemName)).join(language === 'bn' ? ' এবং ' : ' and ');
  if (language === 'bn') {
    const nutrientMatch = {
      sodium: 'সোডিয়ামের পরিমাণ',
      sugar: 'চিনির পরিমাণ',
      fiber: 'আঁশের ঘাটতি',
      protein: 'প্রোটিনের পরিমাণ',
      carbs: 'কার্বোহাইড্রেটের পরিমাণ',
      fat: 'চর্বির পরিমাণ',
      kcal: 'ক্যালরির পরিমাণ',
    }[topWarn[0].nutrient];
    return `মূলত ${names}-এর কারণে—এই খাবারে ${nutrientMatch} লক্ষ্য করার মতো।`;
  }
  const nutrientMatch = topWarn[0].nutrient === 'sodium'
    ? 'sodium load'
    : topWarn[0].nutrient === 'sugar'
      ? 'sugar spike'
      : topWarn[0].nutrient === 'fiber'
        ? 'fiber gap'
        : 'flagged nutrient';
  return `Driven mostly by ${names} — that's where the ${nutrientMatch} is coming from for this meal.`;
}

export function localizedItemReason(
  verdict: ItemVerdict,
  language: 'en' | 'bn',
  foodName: (name: string) => string,
): string {
  if (language === 'en') return verdict.reason;

  const name = foodName(verdict.itemName);
  const amount = verdict.nutrient === 'sodium'
    ? Math.round(verdict.amount)
    : Math.round(verdict.amount * 10) / 10;

  if (verdict.tone === 'warn') {
    switch (verdict.nutrient) {
      case 'sodium':
        return `${name} থেকে ${amount} মিলিগ্রাম সোডিয়াম পাওয়া যায়—এটি আপনার দৈনিক সীমার ${Math.round((verdict.amount / MOCK_TARGETS.sodium) * 100)}%।`;
      case 'sugar':
        return `${name}-এ ${amount} গ্রাম চিনি রয়েছে—প্রিডায়াবেটিস-বান্ধব খাবারের জন্য এটি উল্লেখযোগ্য পরিমাণ।`;
      case 'fiber':
        return `${name} ${amount} গ্রাম আঁশের ভালো উৎস—এটি পুরো খাবারকে লক্ষ্যের কাছাকাছি আনে।`;
      case 'protein':
        return `${name}-এ ${amount} গ্রাম প্রোটিন রয়েছে—একটি খাবারের জন্য ভালো পরিমাণ।`;
      default:
        return `${name} এই খাবারে উল্লেখযোগ্য পরিমাণ ${verdict.nutrient} যোগ করে।`;
    }
  }

  switch (verdict.nutrient) {
    case 'sugar':
      return `${name} থেকে মাত্র প্রায় ${amount} গ্রাম চিনি পাওয়া যায়—আপনার প্রিডায়াবেটিস-বান্ধব লক্ষ্যের মধ্যে রয়েছে।`;
    case 'fiber':
      return `${name} থেকে মাত্র প্রায় ${amount} গ্রাম আঁশ পাওয়া যায়—পুরো খাবারটি দৈনিক ৩০ গ্রামের লক্ষ্য পূরণ করে না। পরেরবার পূর্ণশস্য বা ডাল যোগ করুন।`;
    case 'protein':
      return `${name}-এ প্রোটিন কম (প্রায় ${amount} গ্রাম)—সঙ্গে ডাল বা পনির যোগ করতে পারেন।`;
    default:
      return `${name} থেকে অল্প পরিমাণ ${verdict.nutrient} পাওয়া যায়।`;
  }
}

interface ExplainabilityVerdictsProps {
  contributions: NutrientContribution[];
  profile?: UserProfile;
}

function ExplainabilityVerdicts({ contributions, profile }: ExplainabilityVerdictsProps) {
  const { language, foodName } = useLanguage();
  const verdicts = useMemo(() => buildItemVerdicts(contributions), [contributions]);
  if (verdicts.length === 0) return null;
  const mealVerdict = buildMealVerdict(
    verdicts,
    !!profile?.goals.diabetic,
    language,
    foodName,
  );

  return (
    <LocalizedContent>
      <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.46 }}
      className="glass-card"
      style={{
        borderRadius: 22,
        padding: '14px 16px',
        marginBottom: 18,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
        }}
      >
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: T.primary,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Sparkles size={12} color="#FFFFFF" strokeWidth={2.4} />
        </span>
        <div
          style={{
            fontFamily: 'Inter',
            fontSize: 13,
            fontWeight: 600,
            color: T.ink,
          }}
        >
          Why we flagged this
        </div>
        <div
          style={{
            marginLeft: 'auto',
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 9,
            fontWeight: 600,
            color: T.inkSoft,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            background: 'rgba(74, 58, 52, 0.08)',
            padding: '3px 6px',
            borderRadius: 6,
          }}
        >
          Per-item reasoning
        </div>
      </div>

      <div
        role="list"
        aria-label="Per-item verdict explanations"
        style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
      >
        {verdicts.map((v, idx) => (
          <motion.div
            key={`${v.itemName}-${idx}`}
            role="listitem"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.5 + idx * 0.04 }}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 14,
              background:
                v.tone === 'warn'
                  ? 'rgba(201, 98, 45, 0.08)'
                  : 'rgba(74, 138, 78, 0.08)',
              border:
                v.tone === 'warn'
                  ? '1px solid rgba(201, 98, 45, 0.22)'
                  : '1px solid rgba(74, 138, 78, 0.22)',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                flexShrink: 0,
                marginTop: 1,
                background: v.tone === 'warn' ? T.accentWarn : T.accentGood,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                fontFamily: 'Inter',
                fontSize: 10,
                fontWeight: 800,
              }}
            >
              {v.tone === 'warn' ? '!' : '✓'}
            </span>
            <div
              style={{
                fontFamily: 'Inter',
                fontSize: 12,
                lineHeight: 1.45,
                color: T.ink,
              }}
            >
              {localizedItemReason(v, language, foodName)}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Meal verdict — one sentence tying the top flags together. */}
      <div
        style={{
          marginTop: 12,
          padding: '10px 12px',
          borderRadius: 12,
          background: 'rgba(74, 58, 52, 0.06)',
          fontFamily: 'Inter',
          fontSize: 12,
          fontWeight: 600,
          color: T.ink,
          lineHeight: 1.45,
        }}
        aria-label="Meal verdict"
      >
        <span
          style={{
            display: 'inline-block',
            marginRight: 6,
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: T.inkSoft,
            textTransform: 'uppercase',
          }}
        >
          Meal verdict
        </span>
        <br />
        {mealVerdict}
      </div>
      </motion.div>
    </LocalizedContent>
  );
}

interface NutrientsScreenProps {
  detected?: DetectedItem[];
  profile?: UserProfile;
  onBack?: () => void;
}

/**
 * Nutrients screen — derives macros from current detected items,
 * animates count-up, and recomputes when grams change.
 */
export default function NutrientsScreen({ detected = [], profile, onBack }: NutrientsScreenProps) {
  const { foodName, language } = useLanguage();
  const [resolvedNutritionMap, setResolvedNutritionMap] = useState<Record<string, NutritionFacts>>({});
  const [contributions, setContributions] = useState<NutrientContribution[]>([]);

  // Synchronously derive totals so count-up animations feel responsive,
  // enhanced by live resolved nutrition when available.
  const totals = useMemo(() => {
    const sums = { protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0, sugar: 0, glycemicNum: 0, weight: 0 };
    for (const it of detected) {
      const key = it.name.toLowerCase().trim();
      const n = getEffectiveNutrition(it.name, resolvedNutritionMap[key]);
      const factor = it.grams / 100;
      sums.protein += n.protein * factor;
      sums.carbs   += n.carbs   * factor;
      sums.fat     += n.fat     * factor;
      sums.fiber   += n.fiber   * factor;
      sums.sodium  += n.sodium  * factor;
      sums.sugar   += n.sugar   * factor;
      sums.glycemicNum += (n.glycemic ?? 0.3) * factor;
      sums.weight += factor;
    }
    return {
      protein: sums.protein, carbs: sums.carbs, fat: sums.fat,
      fiber: sums.fiber, sodium: sums.sodium, sugar: sums.sugar,
      glycemic: sums.weight > 0 ? sums.glycemicNum / sums.weight : 0,
    };
  }, [detected, resolvedNutritionMap]);

  // Async nutrition resolution drives the explainability panel and enriches totals.
  useEffect(() => {
    let cancelled = false;
    resolveNutrition(detected, profile)
      .then((res) => {
        if (!cancelled) {
          setContributions(res.contributions);
          const map: Record<string, NutritionFacts> = {};
          for (const r of res.resolved) {
            if (r.nutrition) {
              map[r.name.toLowerCase().trim()] = r.nutrition;
            }
          }
          setResolvedNutritionMap(map);
        }
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('resolveNutrition failed:', err);
        if (!cancelled) setContributions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [detected, profile]);

  const protein = useCountUp(Math.round(totals.protein));
  const carbs = useCountUp(Math.round(totals.carbs));
  const fat = useCountUp(Math.round(totals.fat));
  const fiber = useCountUp(Math.round(totals.fiber));
  const sodium = useCountUp(Math.round(totals.sodium));
  const sugar = useCountUp(Math.round(totals.sugar));

  const overCarbs = totals.carbs > MOCK_TARGETS.carbs;
  const glycemicHigh = totals.glycemic > 0.65;
  const showWarning = overCarbs && glycemicHigh;

  // Pick which nutrients get flagged based on user goal. Mirrors the same
  // focus logic in `lib/personalize.ts` so the verdict strip can't drift.
  const flaggedNutrients = focusedNutrients(profile);

  return (
    <LocalizedContent>
    <div style={{ padding: '20px var(--screen-gutter, 24px) 0' }}>
      {detected.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="glass-card"
          style={{
            borderRadius: 20,
            padding: '32px 24px',
            textAlign: 'center',
            marginTop: 20,
          }}
        >
          <div style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'rgba(74, 58, 52, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <AlertTriangle size={24} color={T.inkMuted} />
          </div>
          <div style={{ fontFamily: 'Inter', fontSize: 16, fontWeight: 600, color: T.ink, marginBottom: 8 }}>
            No meal analyzed yet
          </div>
          <div style={{ fontFamily: 'Inter', fontSize: 13, color: T.inkSoft, lineHeight: 1.4 }}>
            Start by snapping a photo of your plate!
          </div>
        </motion.div>
      )}

      {onBack && (
        <motion.button
          type="button"
          onClick={onBack}
          whileHover={{ x: -2 }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 380, damping: 22 }}
          aria-label="Back to results"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            background: 'none',
            border: 'none',
            padding: '4px 6px',
            fontFamily: 'Inter',
            fontSize: 12,
            fontWeight: 600,
            color: T.inkSoft,
            cursor: 'pointer',
            marginBottom: 8,
          }}
        >
          <ChevronLeft size={14} /> Back to results
        </motion.button>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <motion.h2
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{
            fontFamily: 'Inter',
            fontSize: 24,
            fontWeight: 600,
            color: T.ink,
            letterSpacing: '-0.02em',
          }}
        >
          This meal, explained
        </motion.h2>
        {detected.length > 0 && (
          <motion.button
            type="button"
            onClick={() => {
              const lines = [
                `NutriVision - ${detected.length} items, ${Math.round(totals.protein)}g protein, ${Math.round(totals.carbs)}g carbs, ${Math.round(totals.fat)}g fat`,
                '',
                ...detected.map((d) => {
                  const n = NUTRITION_DB[d.name];
                  const kcal = n ? Math.round(n.kcal * d.grams / 100) : '?';
                  return `  ${foodName(d.name, d.name_bn)} (${d.grams}g) - ${kcal} kcal`;
                }),
              ].join('\n');
              if (navigator?.clipboard) navigator.clipboard.writeText(lines).catch(() => {});
            }}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 380, damping: 22 }}
            aria-label="Share nutrition summary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              background: 'none',
              border: 'none',
              padding: '5px 6px',
              fontFamily: 'Inter',
              fontSize: 11.5,
              fontWeight: 600,
              color: T.primary,
              cursor: 'pointer',
              minHeight: 32,
            }}
          >
            <Share2 size={12} /> Share
          </motion.button>
        )}
      </div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.08 }}
        style={{
          fontFamily: 'Inter',
          fontSize: 13,
          color: T.inkSoft,
          margin: '4px 0 20px',
          lineHeight: 1.4,
        }}
      >
        {profile?.goals.diabetic
          ? 'Filtered for your prediabetic-friendly goal.'
          : 'Personalized against your active goals.'}
      </motion.p>

      {/* Macro donuts */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.08 } },
        }}
        className="glass-card macro-donut-card"
        style={{
          display: 'flex',
          gap: 8,
          padding: '20px 16px',
          borderRadius: 22,
          marginBottom: 18,
        }}
      >
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 8 },
            show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
          }}
          style={{ flex: 1, minWidth: 0 }}
        >
          <MacroDonut
            value={Math.round(protein)}
            target={MOCK_TARGETS.protein}
            color={T.primary}
            label="Protein"
            delay={0.1}
          />
        </motion.div>
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 8 },
            show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
          }}
          style={{ flex: 1, minWidth: 0 }}
        >
          <MacroDonut
            value={Math.round(carbs)}
            target={MOCK_TARGETS.carbs}
            color={overCarbs ? T.accentWarn : T.primary}
            label="Carbs"
            delay={0.18}
          />
        </motion.div>
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 8 },
            show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
          }}
          style={{ flex: 1, minWidth: 0 }}
        >
          <MacroDonut
            value={Math.round(fat)}
            target={MOCK_TARGETS.fat}
            color={T.accentGood}
            label="Fat"
            delay={0.26}
          />
        </motion.div>
      </motion.div>

      {/* Micronutrient bars */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.35 }}
        className="glass-card"
        style={{
          borderRadius: 22,
          padding: '16px 18px',
          marginBottom: 18,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}
        >
          <div
            style={{
              fontFamily: 'Inter',
              fontSize: 13,
              fontWeight: 600,
              color: T.ink,
            }}
          >
            Micronutrients
          </div>
          <div
            title="Daily reference values"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontFamily: 'Inter',
              fontSize: 10,
              color: T.inkSoft,
            }}
          >
            <Info size={10} /> vs targets
          </div>
        </div>

        <Bar
          label="Fiber"
          pct={Math.min(100, Math.round((totals.fiber / MOCK_TARGETS.fiber) * 100))}
          color={T.primary}
          sub={`${Math.round(fiber)}g / target ${MOCK_TARGETS.fiber}g`}
          delay={0.4}
        />
        <Bar
          label="Sodium"
          pct={Math.min(100, Math.round((totals.sodium / MOCK_TARGETS.sodium) * 100))}
          color={T.accentAmber}
          sub={`${Math.round(sodium)}mg / ${MOCK_TARGETS.sodium}mg`}
          delay={0.47}
        />
        <Bar
          label="Sugar"
          pct={Math.min(100, Math.round((totals.sugar / MOCK_TARGETS.sugar) * 100))}
          color={T.accentWarn}
          sub={`${Math.round(sugar)}g / ${MOCK_TARGETS.sugar}g`}
          delay={0.54}
        />
      </motion.div>

      {/* Blueprint Section 2: Explainability Layer — SHAP contribution strip */}
      <AnimatePresence>
        {contributions.length > 0 && (
          <ExplainabilityStrip
            contributions={contributions}
            flaggedNutrients={flaggedNutrients}
          />
        )}
      </AnimatePresence>

      {/* Blueprint Section 2: Per-item verdict chips + meal verdict sentence.
          This is the headline reasoning layer — the part judges can read out loud. */}
      <AnimatePresence>
        {contributions.length > 0 && (
          <ExplainabilityVerdicts contributions={contributions} profile={profile} />
        )}
      </AnimatePresence>

      {/* Soft warning when carbs + glycemic load are both high together. */}
      <AnimatePresence>
        {showWarning && (
          <motion.div
            key="warn"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="glass-tint"
            style={{
              borderRadius: 18,
              padding: '14px 16px',
              display: 'flex',
              gap: 10,
              marginBottom: 16,
            }}
            role="note"
          >
            <AlertTriangle
              size={18}
              color={T.accentWarn}
              style={{ flexShrink: 0, marginTop: 1 }}
              aria-hidden="true"
            />
            <div
              style={{
                fontFamily: 'Inter',
                fontSize: 12,
                color: T.ink,
                lineHeight: 1.5,
              }}
            >
              {language === 'bn' ? (
                <>
                  <b style={{ color: T.accentWarn }}>সতর্কতার কারণ:</b> কার্বোহাইড্রেটের পরিমাণ{' '}
                  <b>{Math.round(totals.carbs)} গ্রাম</b>, যেখানে লক্ষ্য {MOCK_TARGETS.carbs} গ্রাম;
                  গ্লাইসেমিক লোড প্রিডায়াবেটিসের সর্বোচ্চ সীমার{' '}
                  <b>{Math.round(totals.glycemic * 100)}%</b>। দ্রুত হজম হওয়া এই সমন্বয়টি এড়াতে
                  ভাতের অর্ধেকের বদলে অতিরিক্ত রায়তা নিলে প্রোটিন অক্ষুণ্ণ রেখেই দুই মান লক্ষ্যের
                  মধ্যে আনা যাবে।
                </>
              ) : (
                <>
                  <b style={{ color: T.accentWarn }}>Why this is flagged:</b> carbs run{' '}
                  <b>{Math.round(totals.carbs)}g</b> against a {MOCK_TARGETS.carbs}g target, and the
                  glycemic load is sitting at{' '}
                  <b>{Math.round(totals.glycemic * 100)}%</b> of the prediabetic ceiling —
                  that's a fast-digesting combo. Swapping half the rice for extra raita would
                  bring both back into range without losing the plate's protein.
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </LocalizedContent>
  );
}