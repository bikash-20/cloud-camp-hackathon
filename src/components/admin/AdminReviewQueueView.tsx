import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Edit3, Check, X } from 'lucide-react';
import { getReviewQueue, updateReviewQueue } from '../../lib/api';
import type { ReviewQueueItem } from '../../types/schemas';
import { useLanguage } from '../../i18n/LanguageContext';
import { formatRelative, toBengaliDigits } from '../../lib/format';

export default function AdminReviewQueueView() {
  const { language } = useLanguage();
  const isBn = language === 'bn';

  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'corrected' | 'dismissed'>('all');
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state for correction
  const [correctingMeal, setCorrectingMeal] = useState<ReviewQueueItem | null>(null);
  const [correctedLabel, setCorrectedLabel] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadQueue = useCallback(() => {
    setLoading(true);
    getReviewQueue(statusFilter)
      .then((data) => setItems(data || []))
      .catch((err) => {
        console.error('Failed to load review queue:', err);
      })
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const handleAction = async (mealId: string, action: 'approve' | 'dismiss') => {
    try {
      setActionLoading(true);
      const updated = await updateReviewQueue(mealId, { action });
      setItems((prev) => prev.map((item) => (item.mealId === mealId ? updated : item)));
    } catch (err) {
      console.error(`Failed to ${action} meal:`, err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenCorrectModal = (meal: ReviewQueueItem) => {
    setCorrectingMeal(meal);
    setCorrectedLabel(meal.label);
  };

  const handleSaveCorrection = async () => {
    if (!correctingMeal) return;
    try {
      setActionLoading(true);
      const updated = await updateReviewQueue(correctingMeal.mealId, {
        action: 'correct',
        correctedLabel: correctedLabel.trim() || correctingMeal.label,
      });
      setItems((prev) => prev.map((item) => (item.mealId === correctingMeal.mealId ? updated : item)));
      setCorrectingMeal(null);
    } catch (err) {
      console.error('Failed to save correction:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const statusPills: Array<{ id: 'all' | 'pending' | 'approved' | 'corrected' | 'dismissed'; labelEn: string; labelBn: string }> = [
    { id: 'all', labelEn: 'All Flagged', labelBn: 'সব চিহ্নিত' },
    { id: 'pending', labelEn: 'Pending', labelBn: 'অপেক্ষমাণ' },
    { id: 'approved', labelEn: 'Approved', labelBn: 'অনুমোদিত' },
    { id: 'corrected', labelEn: 'Corrected', labelBn: 'সংশোধিত' },
    { id: 'dismissed', labelEn: 'Dismissed', labelBn: 'বাতিল' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header & Status Filter */}
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
            {isBn ? 'পর্যালোচনা তালিকা' : 'Review Queue'}
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
              ? '৭০% এর কম নিশ্চয়তার খাবারসমূহ যাচাই ও সংশোধন করুন'
              : 'Review meals with detection confidence below 70%'}
          </p>
        </div>

        {/* Status Filter Buttons */}
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
          {statusPills.map((pill) => {
            const active = statusFilter === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => setStatusFilter(pill.id)}
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
                {isBn ? pill.labelBn : pill.labelEn}
              </button>
            );
          })}
        </div>
      </div>

      {/* Review Queue Table */}
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
                <th style={{ padding: '14px 16px' }}>{isBn ? 'খাবার' : 'Meal'}</th>
                <th style={{ padding: '14px 16px' }}>{isBn ? 'শনাক্তকৃত উপাদান' : 'Detected Items'}</th>
                <th style={{ padding: '14px 16px' }}>{isBn ? 'সর্বনিম্ন নিশ্চয়তা' : 'Lowest Confidence'}</th>
                <th style={{ padding: '14px 16px' }}>{isBn ? 'ব্যবহারকারী' : 'User'}</th>
                <th style={{ padding: '14px 16px' }}>{isBn ? 'সময়' : 'Time'}</th>
                <th style={{ padding: '14px 16px' }}>{isBn ? 'অবস্থা' : 'Status'}</th>
                <th style={{ padding: '14px 16px', textAlign: 'right' }}>{isBn ? 'পদক্ষেপ' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px 16px', textAlign: 'center' }}>
                    <div className="skeleton" style={{ width: 140, height: 20, margin: '0 auto', borderRadius: 8 }} />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '48px 16px', textAlign: 'center', color: 'rgba(249, 242, 228, 0.5)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                      <CheckCircle size={28} strokeWidth={1.5} color="#B8C68A" />
                      <div>{isBn ? 'পর্যালোচনা তালিকায় কোনো চিহ্নিত খাবার নেই' : 'No flagged meals in review queue'}</div>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((meal) => {
                  const isPending = meal.reviewStatus === 'pending';
                  const isApproved = meal.reviewStatus === 'approved';
                  const isCorrected = meal.reviewStatus === 'corrected';
                  const isDismissed = meal.reviewStatus === 'dismissed';

                  return (
                    <tr
                      key={meal.mealId}
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
                      {/* Meal Label + Thumbnail */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {meal.photoUrl ? (
                            <img
                              src={meal.photoUrl}
                              alt={meal.label}
                              style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 8,
                                background: 'rgba(255, 255, 255, 0.06)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 16,
                              }}
                            >
                              🍲
                            </div>
                          )}
                          <div style={{ fontWeight: 600, color: '#F9F2E4', maxWidth: 180 }}>
                            {meal.label}
                          </div>
                        </div>
                      </td>

                      {/* Detected Items */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 260 }}>
                          {meal.items.map((it, idx) => (
                            <span
                              key={idx}
                              style={{
                                padding: '2px 6px',
                                borderRadius: 4,
                                fontSize: 11,
                                background: it.confidence < 70 ? 'rgba(240, 183, 154, 0.18)' : 'rgba(255, 255, 255, 0.06)',
                                color: it.confidence < 70 ? '#F0B79A' : 'rgba(249, 242, 228, 0.75)',
                                border: `1px solid ${it.confidence < 70 ? 'rgba(240, 183, 154, 0.35)' : 'rgba(255, 255, 255, 0.08)'}`,
                              }}
                            >
                              {it.name} ({isBn ? `${toBengaliDigits(Math.round(it.confidence))}%` : `${Math.round(it.confidence)}%`})
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Lowest Confidence */}
                      <td style={{ padding: '14px 16px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            background: meal.lowestConfidence < 70 ? 'rgba(240, 183, 154, 0.20)' : 'rgba(184, 198, 138, 0.20)',
                            color: meal.lowestConfidence < 70 ? '#F0B79A' : '#B8C68A',
                            border: `1px solid ${meal.lowestConfidence < 70 ? 'rgba(240, 183, 154, 0.4)' : 'rgba(184, 198, 138, 0.4)'}`,
                          }}
                        >
                          {isBn ? `${toBengaliDigits(meal.lowestConfidence.toFixed(1))}%` : `${meal.lowestConfidence.toFixed(1)}%`}
                        </span>
                      </td>

                      {/* User */}
                      <td style={{ padding: '14px 16px', color: 'rgba(249, 242, 228, 0.75)' }}>
                        <div>{meal.userName || meal.userEmail.split('@')[0]}</div>
                        <div style={{ fontSize: 11, color: 'rgba(249, 242, 228, 0.45)' }}>{meal.userEmail}</div>
                      </td>

                      {/* Timestamp */}
                      <td style={{ padding: '14px 16px', color: 'rgba(249, 242, 228, 0.65)' }}>
                        {formatRelative(meal.timestamp, new Date(), language)}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 16px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            textTransform: 'capitalize',
                            background: isPending
                              ? 'rgba(232, 196, 154, 0.16)'
                              : isApproved
                              ? 'rgba(184, 198, 138, 0.16)'
                              : isCorrected
                              ? 'rgba(208, 174, 146, 0.2)'
                              : 'rgba(255, 255, 255, 0.06)',
                            color: isPending
                              ? '#E8C49A'
                              : isApproved
                              ? '#B8C68A'
                              : isCorrected
                              ? '#D0AE92'
                              : 'rgba(249, 242, 228, 0.5)',
                            border: `1px solid ${
                              isPending
                                ? 'rgba(232, 196, 154, 0.35)'
                                : isApproved
                                ? 'rgba(184, 198, 138, 0.35)'
                                : isCorrected
                                ? 'rgba(208, 174, 146, 0.35)'
                                : 'rgba(255, 255, 255, 0.1)'
                            }`,
                          }}
                        >
                          {meal.reviewStatus}
                        </span>
                      </td>

                      {/* Action buttons */}
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            type="button"
                            title="Approve detection"
                            disabled={actionLoading || isApproved}
                            onClick={() => handleAction(meal.mealId, 'approve')}
                            style={{
                              padding: '5px 8px',
                              borderRadius: 6,
                              background: 'rgba(184, 198, 138, 0.15)',
                              border: '1px solid rgba(184, 198, 138, 0.3)',
                              color: '#B8C68A',
                              cursor: isApproved ? 'default' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 11,
                              fontWeight: 600,
                            }}
                          >
                            <Check size={12} strokeWidth={2.5} />
                            {isBn ? 'অনুমোদন' : 'Approve'}
                          </button>

                          <button
                            type="button"
                            title="Correct label"
                            disabled={actionLoading}
                            onClick={() => handleOpenCorrectModal(meal)}
                            style={{
                              padding: '5px 8px',
                              borderRadius: 6,
                              background: 'rgba(208, 174, 146, 0.15)',
                              border: '1px solid rgba(208, 174, 146, 0.3)',
                              color: '#D0AE92',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 11,
                              fontWeight: 600,
                            }}
                          >
                            <Edit3 size={12} strokeWidth={2.5} />
                            {isBn ? 'সংশোধন' : 'Correct'}
                          </button>

                          <button
                            type="button"
                            title="Dismiss from queue"
                            disabled={actionLoading || isDismissed}
                            onClick={() => handleAction(meal.mealId, 'dismiss')}
                            style={{
                              padding: '5px 8px',
                              borderRadius: 6,
                              background: 'rgba(255, 255, 255, 0.05)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              color: 'rgba(249, 242, 228, 0.55)',
                              cursor: isDismissed ? 'default' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 11,
                              fontWeight: 600,
                            }}
                          >
                            <X size={12} strokeWidth={2.5} />
                            {isBn ? 'বাতিল' : 'Dismiss'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Correct Label Modal */}
      <AnimatePresence>
        {correctingMeal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 60,
              background: 'rgba(0, 0, 0, 0.7)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
            onClick={() => setCorrectingMeal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{
                width: '100%',
                maxWidth: 420,
                background: '#1F1815',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 16,
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#F9F2E4', margin: 0 }}>
                {isBn ? 'খাবারের নাম সংশোধন করুন' : 'Correct Food Label'}
              </h3>
              <p style={{ fontSize: 13, color: 'rgba(249, 242, 228, 0.65)', margin: 0 }}>
                {isBn
                  ? 'শনাক্তকৃত নামটির ত্রুটি সংশোধন করে সঠিক নাম লিখুন:'
                  : 'Enter the verified and accurate name for this meal:'}
              </p>

              <input
                type="text"
                value={correctedLabel}
                onChange={(e) => setCorrectedLabel(e.target.value)}
                placeholder="e.g. Chicken Roast with Polao"
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: 10,
                  padding: '10px 14px',
                  color: '#F9F2E4',
                  fontSize: 14,
                  fontFamily: 'Inter',
                  outline: 'none',
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setCorrectingMeal(null)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: 'none',
                    borderRadius: 8,
                    padding: '8px 14px',
                    color: '#F9F2E4',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleSaveCorrection}
                  style={{
                    background: '#D0AE92',
                    border: 'none',
                    borderRadius: 8,
                    padding: '8px 16px',
                    color: '#1B1411',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {isBn ? 'সংরক্ষণ করুন' : 'Save Correction'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
