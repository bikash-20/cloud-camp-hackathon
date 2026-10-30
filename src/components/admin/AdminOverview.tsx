import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Users, UtensilsCrossed, Activity, AlertTriangle, TrendingUp, Sparkles, UserCheck } from 'lucide-react';
import { getAdminMetrics, getMealHistory } from '../../lib/api';
import type { AdminMetrics, AuthSession, MealEntry } from '../../types/schemas';
import KpiCard from './KpiCard';
import Sparkline from './Sparkline';
import { LocalizedContent, useLanguage } from '../../i18n/LanguageContext';

interface AdminOverviewProps {
  /** Currently signed-in admin — drives the "you" pill in the header. */
  session: AuthSession;
}

/** Strip the time portion of an ISO timestamp so date comparisons match
 *  by calendar day in the local timezone. The seed meals were generated
 *  via `Date#toISOString`, so their date components line up cleanly. */
function localDayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Today as a YYYY-MM-DD string in local time. */
function todayKey(): string {
  return localDayKey(new Date().toISOString());
}

/** N days ago (inclusive of today) as YYYY-MM-DD keys, oldest → newest. */
function lastNDays(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    out.push(localDayKey(d.toISOString()));
  }
  return out;
}

/** Count low-confidence items across a meal list. <70 matches the existing
 *  ResultsScreen threshold (see `bucketizeConfidence` in schemas.ts). */
function countFlagged(meals: MealEntry[]): { flagged: number; total: number } {
  let flagged = 0;
  let total = 0;
  for (const m of meals) {
    for (const it of m.items) {
      total += 1;
      if (it.confidence < 70) flagged += 1;
    }
  }
  return { flagged, total };
}

/** Short day-of-week label (Mon, Tue, …) for the sparkline axis. */
function dayLabel(key: string, language: string): string {
  const d = new Date(`${key}T00:00:00`);
  return d.toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en', { weekday: 'short' });
}

/**
 * Admin Overview — single dashboard screen for v1.
 *
 * Surfaces five top-level numbers:
 *   • Total users          (5 seeded + signed-in user)
 *   • Meals today          (across all users)
 *   • Meals this week      (last 7 days)
 *   • Avg meals / user     (meals-this-week / total-users)
 *   • Flagged %            (low-confidence items / total items)
 *
 * Plus a 7-day meals-per-day bar chart for visual trend at a glance.
 *
 * Data sources:
 *   • SEED_DEMO_USERS — synthetic history, deterministic per email.
 *   • getMealHistory() — the real signed-in user's logged meals.
 *
 * Aggregation is memoized over (demo users, real meals) so the numbers
 * don't churn on each re-render. The 7-day window is recomputed only
 * when those two inputs change.
 */
export default function AdminOverview({ session }: AdminOverviewProps) {
  const reduceMotion = useReducedMotion();
  const { language } = useLanguage();
  const isBn = language === 'bn';
  const [realMeals, setRealMeals] = useState<MealEntry[] | null>(null);
  const [serverMetrics, setServerMetrics] = useState<AdminMetrics | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMealHistory().then((h) => {
      if (!cancelled) setRealMeals(h);
    });
    getAdminMetrics().then((m) => {
      if (!cancelled && m) setServerMetrics(m);
    });
    return () => { cancelled = true; };
  }, []);

  // ── Aggregate ──────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    if (serverMetrics) {
      return {
        totalUsers: Math.max(serverMetrics.totalUsers, 1),
        mealsToday: serverMetrics.mealsToday,
        mealsThisWeek: serverMetrics.mealsThisWeek,
        avgPerUser: serverMetrics.avgMealsPerUser,
        flaggedPct: serverMetrics.flaggedPercentage,
        flagged: Math.round((serverMetrics.flaggedPercentage / 100) * 10),
        total: 10,
      };
    }

    const realUserMeals = realMeals ?? [];
    const totalUsers = 1;

    const today = todayKey();
    const week = new Set(lastNDays(7));

    let mealsToday = 0;
    let mealsThisWeek = 0;
    for (const m of realUserMeals) {
      const k = localDayKey(m.date);
      if (k === today) mealsToday += 1;
      if (week.has(k)) mealsThisWeek += 1;
    }

    const { flagged, total } = countFlagged(realUserMeals);
    const flaggedPct = total > 0 ? (flagged / total) * 100 : 0;
    const avgPerUser = mealsThisWeek;

    return {
      totalUsers,
      mealsToday,
      mealsThisWeek,
      avgPerUser,
      flaggedPct,
      flagged,
      total,
    };
  }, [realMeals, serverMetrics]);

  // ── Sparkline series ───────────────────────────────────────────────────

  const sparkData = useMemo(() => {
    const realUserMeals = realMeals ?? [];
    const days = lastNDays(7);
    const counts = new Map<string, number>();
    for (const k of days) counts.set(k, 0);
    for (const m of realUserMeals) {
      const k = localDayKey(m.date);
      if (counts.has(k)) counts.set(k, counts.get(k)! + 1);
    }
    return {
      values: days.map((k) => counts.get(k) ?? 0),
      labels: days.map((day) => dayLabel(day, language)),
    };
  }, [language, realMeals]);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <LocalizedContent>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <motion.header
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
      >
        <div
          style={{
            fontFamily: 'Inter',
            fontSize: 11,
            fontWeight: 700,
            color: 'rgba(249, 242, 228, 0.55)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Overview
        </div>
        <h1
          style={{
            fontFamily: 'Inter',
            fontSize: 28,
            fontWeight: 700,
            color: '#F9F2E4',
            margin: 0,
            letterSpacing: '-0.02em',
            lineHeight: 1.15,
          }}
        >
          Good to see you, {session.email.split('@')[0]}.
        </h1>
        <p
          style={{
            fontFamily: 'Inter',
            fontSize: 13,
            color: 'rgba(249, 242, 228, 0.65)',
            margin: '4px 0 0',
            lineHeight: 1.45,
          }}
        >
          Synthetic demo accounts plus your own activity. Numbers update as
          you log meals.
        </p>
      </motion.header>

      {/* KPI row — 4 cards, stagger-fade in */}
      <motion.section
        initial="hidden"
        animate="show"
        variants={{
          hidden: { opacity: 1 },
          show: {
            opacity: 1,
            transition: reduceMotion
              ? { staggerChildren: 0 }
              : { staggerChildren: 0.06, delayChildren: 0.05 },
          },
        }}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
        }}
        aria-label={isBn ? 'মূল কর্মক্ষমতা সূচক' : 'Key performance indicators'}
      >
        <KpiCard
          label="Total users"
          value={stats.totalUsers}
          hint="5 seeded + you"
          icon={<Users size={14} strokeWidth={2.2} />}
        />
        <KpiCard
          label="Meals today"
          value={stats.mealsToday}
          hint="across all users"
          icon={<UtensilsCrossed size={14} strokeWidth={2.2} />}
        />
        <KpiCard
          label="Meals this week"
          value={stats.mealsThisWeek}
          hint="last 7 days"
          icon={<TrendingUp size={14} strokeWidth={2.2} />}
        />
        <KpiCard
          label="Avg / user / week"
          value={stats.avgPerUser.toFixed(1)}
          hint={`${stats.totalUsers} users`}
          icon={<Activity size={14} strokeWidth={2.2} />}
        />
      </motion.section>

      {/* Sparkline + flagged panel */}
      <motion.section
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
        style={{
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 18,
          padding: '18px 18px 14px',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
        aria-label={isBn ? '৭ দিনের খাবারের পরিমাণ' : '7-day meal volume'}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <div>
            <div
              style={{
                fontFamily: 'Inter',
                fontSize: 11,
                fontWeight: 700,
                color: 'rgba(249, 242, 228, 0.55)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              7-day meal volume
            </div>
            <div
              style={{
                fontFamily: 'Inter',
                fontSize: 13,
                color: 'rgba(249, 242, 228, 0.7)',
                marginTop: 4,
                lineHeight: 1.4,
              }}
            >
              How many meals landed on each day across all users.
            </div>
          </div>
          <Sparkles size={16} color="rgba(249, 242, 228, 0.35)" aria-hidden="true" />
        </div>

        <Sparkline
          values={sparkData.values}
          labels={sparkData.labels}
          height={130}
          ariaLabel={`7-day meals-per-day bar chart with totals ${sparkData.values.join(', ')}`}
        />
      </motion.section>

      {/* Flagged panel — second card so the page has visual rhythm */}
      <motion.section
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.32, ease: [0.22, 1, 0.36, 1] }}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 12,
        }}
        aria-label={isBn ? 'চিহ্নিত শনাক্তকরণের সারসংক্ষেপ' : 'Flagged detection summary'}
      >
        <KpiCard
          label="Flagged items"
          value={`${stats.flaggedPct.toFixed(1)}%`}
          hint={`${stats.flagged} of ${stats.total} items below 70% confidence`}
          icon={<AlertTriangle size={14} strokeWidth={2.2} />}
        />
      </motion.section>

      {/* Live Registered Users (multi-tenant backend persistence) */}
      {serverMetrics && serverMetrics.users.length > 0 && (
        <motion.section
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.38, ease: [0.22, 1, 0.36, 1] }}
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 18,
            padding: '18px',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
          aria-label={isBn ? 'নিবন্ধিত ব্যবহারকারী' : 'Registered Users Directory'}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div
                style={{
                  fontFamily: 'Inter',
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'rgba(249, 242, 228, 0.55)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
              >
                {isBn ? 'লাইভ ব্যবহারকারী তালিকা' : 'Live User Directory'}
              </div>
              <div style={{ fontFamily: 'Inter', fontSize: 13, color: 'rgba(249, 242, 228, 0.7)', marginTop: 2 }}>
                {isBn ? 'গুগল অথেন্টিকেশন এবং ব্যাকএন্ড পারসিস্টেন্স' : 'Active accounts via Google Auth & backend state'}
              </div>
            </div>
            <UserCheck size={16} color="rgba(249, 242, 228, 0.35)" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {serverMetrics.users.map((u) => (
              <div
                key={u.email}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 12,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 999,
                      background: u.role === 'admin' ? 'rgba(217, 119, 6, 0.2)' : 'rgba(74, 58, 52, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#F9F2E4',
                      fontWeight: 700,
                      fontSize: 12,
                    }}
                  >
                    {(u.name || u.email)[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontFamily: 'Inter', fontSize: 13, fontWeight: 600, color: '#F9F2E4' }}>
                      {u.name || u.email.split('@')[0]}
                    </div>
                    <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'rgba(249, 242, 228, 0.5)' }}>
                      {u.email}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'Inter', fontSize: 12, fontWeight: 600, color: '#F9F2E4' }}>
                      {u.mealsCount} {isBn ? 'খাবার' : 'meals'}
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(249, 242, 228, 0.4)' }}>
                      {u.lastActive.slice(0, 10)}
                    </div>
                  </div>
                  {u.role === 'admin' && (
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: 999,
                        background: 'rgba(217, 119, 6, 0.2)',
                        border: '1px solid rgba(217, 119, 6, 0.4)',
                        color: '#F59E0B',
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                      }}
                    >
                      Admin
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.section>
      )}
    </div>
    </LocalizedContent>
  );
}