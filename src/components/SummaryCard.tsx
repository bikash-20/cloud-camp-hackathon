import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Flame, TrendingUp, BarChart2 } from 'lucide-react';
import { T } from '../data';
import useCountUp from './useCountUp';
import { LocalizedContent, useLanguage } from '../i18n/LanguageContext';
import { toBengaliDigits } from '../lib/format';
import RevenueCurveChart from './RevenueCurveChart';
import type { UserProfile } from '../types/schemas';
import { getDynamicTargets } from '../lib/personalize';

interface Totals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface SummaryCardProps {
  totals: Totals;
  itemCount: number;
  profile?: UserProfile | null;
}

/**
 * Sticky header summary card for the Results screen with toggleable
 * Revenue-Style trajectory curve and high-contrast macro gauges.
 */
export default function SummaryCard({ totals, itemCount, profile }: SummaryCardProps) {
  const [open, setOpen] = useState(true);
  const [showCurve, setShowCurve] = useState(false);
  const { language } = useLanguage();
  const isBn = language === 'bn';
  const kcal = useCountUp(Math.round(totals.kcal));
  const protein = useCountUp(Math.round(totals.protein));
  const carbs = useCountUp(Math.round(totals.carbs));
  const fat = useCountUp(Math.round(totals.fat));

  const targets = useMemo(() => getDynamicTargets(profile), [profile]);
  const mealsPerDay = Math.max(1, profile?.mealsPerDay ?? 3);
  const targetProtein = Math.max(15, Math.round(targets.protein / mealsPerDay));
  const targetCarbs = Math.max(25, Math.round(targets.carbs / mealsPerDay));
  const targetFat = Math.max(10, Math.round(targets.fat / mealsPerDay));

  const macros = [
    { label: isBn ? 'প্রোটিন' : 'Protein', value: Math.round(protein), color: T.primary, pct: Math.min(100, Math.round((totals.protein / targetProtein) * 100)) },
    { label: isBn ? 'কার্বোহাইড্রেট' : 'Carbs',   value: Math.round(carbs),   color: T.accentAmber, pct: Math.min(100, Math.round((totals.carbs / targetCarbs) * 100)) },
    { label: isBn ? 'চর্বি' : 'Fat',     value: Math.round(fat),     color: T.accentGood, pct: Math.min(100, Math.round((totals.fat / targetFat) * 100)) },
  ];

  return (
    <LocalizedContent>
    <motion.div
      layout
      className="glass-card"
      style={{
        borderRadius: 18,
        padding: open ? '14px 16px' : '10px 14px',
        marginBottom: 12,
        background: 'rgba(255, 255, 255, 0.90)',
        border: '1px solid rgba(74, 58, 52, 0.14)',
        boxShadow: '0 6px 20px rgba(46, 37, 34, 0.08)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'Inter',
              fontSize: 13,
              fontWeight: 700,
              color: T.ink,
              whiteSpace: 'nowrap',
            }}
          >
            🍽️ {isBn ? toBengaliDigits(itemCount) : itemCount} {isBn ? 'টি খাবার' : itemCount === 1 ? 'item' : 'items'}
          </div>
          <span style={{ color: T.inkMuted, fontSize: 12 }}>·</span>
          <span
            className="kcal-chip"
            style={{ fontSize: 12, padding: '3px 8px', fontWeight: 700 }}
          >
            <Flame size={11} /> {isBn ? toBengaliDigits(Math.round(kcal)) : Math.round(kcal)} {isBn ? 'কিলোক্যালরি' : 'kcal'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <motion.button
            type="button"
            onClick={() => setShowCurve((v) => !v)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            title={showCurve ? (isBn ? 'ম্যাক্রো বিবরণ দেখুন' : 'View macros') : (isBn ? 'গতিপথ কার্ভ চার্ট দেখুন' : 'View trajectory curve')}
            style={{
              padding: '4px 8px',
              borderRadius: 8,
              background: showCurve ? 'rgba(201, 98, 45, 0.15)' : 'rgba(74, 58, 52, 0.07)',
              color: showCurve ? T.primary : T.ink,
              border: 'none',
              fontFamily: 'Inter',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {showCurve ? <BarChart2 size={12} /> : <TrendingUp size={12} />}
            <span>{showCurve ? (isBn ? 'ম্যাক্রো' : 'Macros') : (isBn ? 'গতিপথ' : 'Curve')}</span>
          </motion.button>

          <motion.button
            type="button"
            onClick={() => setOpen((v) => !v)}
            whileTap={{ scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 380, damping: 22 }}
            aria-label={open ? (isBn ? 'সারসংক্ষেপ গুটিয়ে নিন' : 'Collapse summary') : (isBn ? 'সারসংক্ষেপ প্রসারিত করুন' : 'Expand summary')}
            aria-expanded={open}
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'rgba(249, 242, 228, 0.7)',
              border: '1px solid rgba(74, 58, 52, 0.15)',
              cursor: 'pointer',
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <motion.span
              animate={{ rotate: open ? 0 : 180 }}
              transition={{ duration: 0.2 }}
              style={{ display: 'inline-flex', color: T.inkSoft }}
            >
              <ChevronDown size={14} />
            </motion.span>
          </motion.button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden', marginTop: 12 }}
          >
            {showCurve ? (
              <RevenueCurveChart
                currentKcal={Math.round(totals.kcal)}
                dailyTarget={targets.kcal}
                mealsLogged={itemCount}
                macros={{
                  protein: Math.round(totals.protein),
                  carbs: Math.round(totals.carbs),
                  fat: Math.round(totals.fat),
                }}
                showMacroChips={false}
                title={isBn ? 'এই খাবারের ক্যালরি প্রভাব' : 'Meal Calorie Trajectory'}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {macros.map((m) => (
                  <div
                    key={m.label}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isBn ? '80px 1fr 60px' : '65px 1fr 50px',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'Inter',
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: T.ink,
                      }}
                    >
                      {m.label}
                    </div>
                    <div
                      style={{
                        height: 8,
                        borderRadius: 4,
                        background: 'rgba(74, 58, 52, 0.08)',
                        overflow: 'hidden',
                        border: '1px solid rgba(255, 255, 255, 0.4)',
                        boxShadow: 'inset 0 1px 2px rgba(46, 37, 34, 0.08)',
                      }}
                    >
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${m.pct}%` }}
                        transition={{ type: 'spring', stiffness: 100, damping: 18 }}
                        style={{
                          height: '100%',
                          background: m.color,
                          borderRadius: 4,
                        }}
                      />
                    </div>
                    <div
                      className="tnum"
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: T.ink,
                        textAlign: 'right',
                      }}
                    >
                      {isBn ? toBengaliDigits(m.value) : m.value} {isBn ? 'গ্রাম' : 'g'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
    </LocalizedContent>
  );
}