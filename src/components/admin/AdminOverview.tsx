import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Users, UtensilsCrossed, Activity, AlertTriangle, TrendingUp, Sparkles, RefreshCw, Clock } from 'lucide-react';
import { getAdminMetrics } from '../../lib/api';
import type { AdminMetrics, AuthSession } from '../../types/schemas';
import KpiCard from './KpiCard';
import Sparkline from './Sparkline';
import { LocalizedContent, useLanguage } from '../../i18n/LanguageContext';
import { toBengaliDigits } from '../../lib/format';

interface AdminOverviewProps {
  session: AuthSession;
}

function dayLabel(dateStr: string, language: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en', { weekday: 'short' });
}

export default function AdminOverview({ session }: AdminOverviewProps) {
  const reduceMotion = useReducedMotion();
  const { language } = useLanguage();
  const isBn = language === 'bn';

  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchMetrics = useCallback((showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    getAdminMetrics()
      .then((data) => {
        if (data) {
          setMetrics(data);
          setLastUpdated(new Date());
        }
      })
      .catch((err) => {
        console.error('Failed to fetch admin metrics:', err);
      })
      .finally(() => {
        setRefreshing(false);
      });
  }, []);

  // Mount + auto-refresh every 30 seconds
  useEffect(() => {
    fetchMetrics();
    const timer = setInterval(() => {
      fetchMetrics(false);
    }, 30000);
    return () => clearInterval(timer);
  }, [fetchMetrics]);

  // Derived stats with safe fallbacks
  const stats = useMemo(() => {
    if (!metrics) {
      return {
        totalUsers: 0,
        newUsersToday: 0,
        newUsersThisWeek: 0,
        activeUsers7d: 0,
        mealsToday: 0,
        mealsThisWeek: 0,
        totalMeals: 0,
        avgPerUser: 0,
        flaggedMealsCount: 0,
        flaggedPct: null as number | null,
      };
    }
    return {
      totalUsers: metrics.totalUsers,
      newUsersToday: metrics.newUsersToday ?? 0,
      newUsersThisWeek: metrics.newUsersThisWeek ?? 0,
      activeUsers7d: metrics.activeUsers7d ?? 0,
      mealsToday: metrics.mealsToday,
      mealsThisWeek: metrics.mealsThisWeek,
      totalMeals: metrics.totalMeals ?? 0,
      avgPerUser: metrics.avgMealsPerUser,
      flaggedMealsCount: metrics.flaggedMealsCount ?? 0,
      flaggedPct: metrics.flaggedPercentage,
    };
  }, [metrics]);

  // 7-day sparkline series from backend daily_meal_volume
  const sparkData = useMemo(() => {
    if (metrics?.dailyMealVolume && metrics.dailyMealVolume.length > 0) {
      return {
        values: metrics.dailyMealVolume.map((d) => d.count),
        labels: metrics.dailyMealVolume.map((d) => dayLabel(d.date, language)),
      };
    }
    // Fallback 7 empty days if no data yet
    const now = new Date();
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const isoDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      days.push(isoDate);
    }
    return {
      values: [0, 0, 0, 0, 0, 0, 0],
      labels: days.map((d) => dayLabel(d, language)),
    };
  }, [metrics, language]);

  const formatTime = (d: Date) => {
    return d.toLocaleTimeString(language === 'bn' ? 'bn-BD' : 'en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <LocalizedContent>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Header with Title and Refresh Controls */}
        <motion.header
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
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
              {isBn ? 'সারসংক্ষেপ' : 'Overview'}
            </div>
            <h1
              style={{
                fontFamily: 'Inter',
                fontSize: 28,
                fontWeight: 700,
                color: '#F9F2E4',
                margin: '4px 0 0',
                letterSpacing: '-0.02em',
                lineHeight: 1.15,
              }}
            >
              {isBn ? 'স্বাগতম' : 'Good to see you'}, {session.name || session.email.split('@')[0]}.
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
              {isBn
                ? 'নিবন্ধিত সব অ্যাকাউন্টের রিয়েল-টাইম কার্যক্রম।'
                : 'Real-time platform activity across registered accounts.'}
            </p>
          </div>

          {/* Refresh button & Last Updated */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                fontSize: 11,
                color: 'rgba(249, 242, 228, 0.5)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <Clock size={12} />
              {isBn ? `সর্বশেষ আপডেট: ${formatTime(lastUpdated)}` : `Updated ${formatTime(lastUpdated)}`}
            </div>
            <button
              type="button"
              onClick={() => fetchMetrics(true)}
              disabled={refreshing}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 12px',
                borderRadius: 10,
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#F9F2E4',
                fontFamily: 'Inter',
                fontSize: 12,
                fontWeight: 600,
                cursor: refreshing ? 'not-allowed' : 'pointer',
              }}
            >
              <RefreshCw
                size={13}
                style={{
                  animation: refreshing ? 'spin 1s linear infinite' : 'none',
                }}
              />
              {isBn ? 'হালনাগাদ করুন' : 'Refresh'}
            </button>
          </div>
        </motion.header>

        {/* KPI Row — 4 cards */}
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
            hint={
              isBn
                ? `আজ ${toBengaliDigits(stats.newUsersToday)} · সক্রিয় ${toBengaliDigits(stats.activeUsers7d)}`
                : `${stats.newUsersToday} today · ${stats.activeUsers7d} active (7d)`
            }
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
            hint={isBn ? `${toBengaliDigits(stats.totalUsers)} জন নিবন্ধিত` : `${stats.totalUsers} registered`}
            icon={<Activity size={14} strokeWidth={2.2} />}
          />
        </motion.section>

        {/* 7-day Meal Volume Panel */}
        <motion.section
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 18,
            padding: '18px 20px',
            backdropFilter: 'blur(8px)',
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
                {isBn ? '৭ দিনের খাবারের পরিমাণ' : '7-day meal volume'}
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
                {isBn
                  ? 'সব ব্যবহারকারীর প্রতিদিনের খাবারের সংখ্যা।'
                  : 'How many meals landed on each day across all users.'}
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

        {/* Flagged Detection Summary Panel */}
        <motion.section
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 12,
          }}
          aria-label={isBn ? 'চিহ্নিত শনাক্তকরণের সারসংক্ষেপ' : 'Flagged detection summary'}
        >
          <KpiCard
            label="Flagged items"
            value={
              stats.totalMeals === 0 || stats.flaggedPct == null
                ? '—'
                : `${Number(stats.flaggedPct).toFixed(1)}%`
            }
            hint={
              stats.totalMeals === 0
                ? isBn
                  ? 'এখনো কোনো খাবার নথিভুক্ত হয়নি'
                  : 'No meals recorded yet across users'
                : isBn
                ? `${toBengaliDigits(stats.totalMeals)}টির মধ্যে ${toBengaliDigits(stats.flaggedMealsCount)}টি খাবারের নিশ্চয়তা ৭০%-এর কম`
                : `${stats.flaggedMealsCount} of ${stats.totalMeals} meals below 70% confidence`
            }
            icon={<AlertTriangle size={14} strokeWidth={2.2} />}
          />
        </motion.section>
      </div>
    </LocalizedContent>
  );
}
