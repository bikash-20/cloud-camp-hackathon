import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';
import { getPopularFoods } from '../../lib/api';
import type { PopularFoodItem } from '../../types/schemas';
import { useLanguage } from '../../i18n/LanguageContext';
import { toBengaliDigits } from '../../lib/format';

export default function AdminPopularFoodsView() {
  const { language } = useLanguage();
  const isBn = language === 'bn';

  const [range, setRange] = useState<'today' | '7d' | '30d' | 'all'>('7d');
  const [foods, setFoods] = useState<PopularFoodItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFoods = useCallback(() => {
    setLoading(true);
    getPopularFoods(range)
      .then((data) => setFoods(data || []))
      .catch((err) => {
        console.error('Failed to load popular foods:', err);
      })
      .finally(() => setLoading(false));
  }, [range]);

  useEffect(() => {
    loadFoods();
  }, [loadFoods]);

  const rangeButtons: Array<{ id: 'today' | '7d' | '30d' | 'all'; labelEn: string; labelBn: string }> = [
    { id: 'today', labelEn: 'Today', labelBn: 'আজ' },
    { id: '7d', labelEn: '7 Days', labelBn: '৭ দিন' },
    { id: '30d', labelEn: '30 Days', labelBn: '৩০ দিন' },
    { id: 'all', labelEn: 'All Time', labelBn: 'সর্বকাল' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header & Filter Controls */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'Inter',
              fontSize: 24,
              fontWeight: 700,
              color: '#F9F2E4',
              margin: 0,
            }}
          >
            {isBn ? 'জনপ্রিয় খাবার' : 'Popular Foods'}
          </h1>
          <p
            style={{
              fontFamily: 'Inter',
              fontSize: 13,
              color: 'rgba(249, 242, 228, 0.65)',
              margin: '4px 0 0',
            }}
          >
            {isBn
              ? 'ব্যবহারকারীদের দ্বারা সবচেয়ে বেশি নথিভুক্ত খাবার ও তাদের অনুপাত'
              : 'Most frequently logged items across all user plates'}
          </p>
        </div>

        {/* Date Range Pill Buttons */}
        <div
          style={{
            display: 'inline-flex',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 999,
            padding: 3,
            gap: 2,
          }}
        >
          {rangeButtons.map((btn) => {
            const active = range === btn.id;
            return (
              <button
                key={btn.id}
                type="button"
                onClick={() => setRange(btn.id)}
                style={{
                  border: 'none',
                  borderRadius: 999,
                  padding: '6px 14px',
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'Inter',
                  cursor: 'pointer',
                  background: active ? '#D0AE92' : 'transparent',
                  color: active ? '#1B1411' : 'rgba(249, 242, 228, 0.75)',
                  transition: 'background 160ms ease, color 160ms ease',
                }}
              >
                {isBn ? btn.labelBn : btn.labelEn}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table Card */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 18,
          overflow: 'hidden',
          backdropFilter: 'blur(10px)',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left',
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: 13,
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  background: 'rgba(255, 255, 255, 0.02)',
                  color: 'rgba(249, 242, 228, 0.55)',
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                <th style={{ padding: '14px 16px', width: 60 }}>#</th>
                <th style={{ padding: '14px 16px' }}>{isBn ? 'খাবারের নাম' : 'Food Name'}</th>
                <th style={{ padding: '14px 16px' }}>{isBn ? 'শ্রেণি' : 'Category'}</th>
                <th style={{ padding: '14px 16px' }}>{isBn ? 'সংখ্যা' : 'Count'}</th>
                <th style={{ padding: '14px 16px' }}>{isBn ? 'অংশীদারিত্ব' : 'Share'}</th>
                <th style={{ padding: '14px 16px' }}>{isBn ? 'গড় নিশ্চয়তা' : 'Avg Confidence'}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px 16px', textAlign: 'center' }}>
                    <div className="skeleton" style={{ width: 140, height: 20, margin: '0 auto', borderRadius: 8 }} />
                  </td>
                </tr>
              ) : foods.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '48px 16px', textAlign: 'center', color: 'rgba(249, 242, 228, 0.5)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                      <Trophy size={28} strokeWidth={1.5} color="rgba(249, 242, 228, 0.3)" />
                      <div>{isBn ? 'এই সময়ের মধ্যে কোনো খাবার নথিভুক্ত করা হয়নি' : 'No food records found for this period'}</div>
                    </div>
                  </td>
                </tr>
              ) : (
                foods.map((food, index) => {
                  const rank = index + 1;
                  const rankColor = rank === 1 ? '#F9F2E4' : rank === 2 ? '#E8C49A' : rank === 3 ? '#D0AE92' : 'rgba(249, 242, 228, 0.55)';

                  return (
                    <tr
                      key={food.name}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        transition: 'background 160ms ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <td style={{ padding: '14px 16px', fontWeight: 700, color: rankColor }}>
                        {isBn ? toBengaliDigits(rank) : `#${rank}`}
                      </td>

                      <td style={{ padding: '14px 16px', fontWeight: 600, color: '#F9F2E4' }}>
                        {food.name}
                      </td>

                      <td style={{ padding: '14px 16px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 600,
                            textTransform: 'capitalize',
                            background: 'rgba(255, 255, 255, 0.06)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            color: 'rgba(249, 242, 228, 0.8)',
                          }}
                        >
                          {food.category}
                        </span>
                      </td>

                      <td style={{ padding: '14px 16px', fontWeight: 600, color: '#F9F2E4' }}>
                        {isBn ? toBengaliDigits(food.count) : food.count}
                      </td>

                      <td style={{ padding: '14px 16px', minWidth: 160 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            style={{
                              flex: 1,
                              height: 6,
                              borderRadius: 999,
                              background: 'rgba(255, 255, 255, 0.08)',
                              overflow: 'hidden',
                            }}
                          >
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(100, food.sharePercentage)}%` }}
                              transition={{ duration: 0.4 }}
                              style={{
                                height: '100%',
                                background: 'linear-gradient(90deg, #D0AE92, #E8C49A)',
                                borderRadius: 999,
                              }}
                            />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(249, 242, 228, 0.8)', minWidth: 40 }}>
                            {isBn ? `${toBengaliDigits(food.sharePercentage.toFixed(1))}%` : `${food.sharePercentage.toFixed(1)}%`}
                          </span>
                        </div>
                      </td>

                      <td style={{ padding: '14px 16px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '2px 7px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            background: food.avgConfidence >= 80 ? 'rgba(184, 198, 138, 0.16)' : 'rgba(240, 183, 154, 0.16)',
                            color: food.avgConfidence >= 80 ? '#B8C68A' : '#F0B79A',
                            border: `1px solid ${food.avgConfidence >= 80 ? 'rgba(184, 198, 138, 0.3)' : 'rgba(240, 183, 154, 0.3)'}`,
                          }}
                        >
                          {isBn ? `${toBengaliDigits(food.avgConfidence.toFixed(1))}%` : `${food.avgConfidence.toFixed(1)}%`}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
