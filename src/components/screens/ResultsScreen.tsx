import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit3, Plus, Share2 } from 'lucide-react';
import {
  T, NUTRITION_DB, HISTORY_SUGGESTIONS,
} from '../../data';
import type { DetectedItem, UserProfile } from '../../types/schemas';
import PhotoThumb from '../PhotoThumb';
import StepIndicator from '../StepIndicator';
import SummaryCard from '../SummaryCard';
import SortMenu, { SORT_OPTIONS } from '../SortMenu';
import ExpandableRow from '../ExpandableRow';
import BulkActionBar from '../BulkActionBar';
import SmartActionSheet from '../SmartActionSheet';

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
};

interface Totals {
  protein: number; carbs: number; fat: number; kcal: number;
  fiber: number; sodium: number; sugar: number;
}

function totalsFor(detected: DetectedItem[]): Totals {
  return detected.reduce(
    (acc, it) => {
      const n = NUTRITION_DB[it.name];
      if (!n) return acc;
      const factor = it.grams / 100;
      return {
        protein: acc.protein + n.protein * factor,
        carbs: acc.carbs + n.carbs * factor,
        fat: acc.fat + n.fat * factor,
        kcal: acc.kcal + n.kcal * factor,
        fiber: acc.fiber + n.fiber * factor,
        sodium: acc.sodium + n.sodium * factor,
        sugar: acc.sugar + n.sugar * factor,
      };
    },
    { protein: 0, carbs: 0, fat: 0, kcal: 0, fiber: 0, sodium: 0, sugar: 0 },
  );
}

/**
 * Inline GI chip — only renders when diabetic profile is active and the item
 * has a known glycemic value. Visualizes the blueprint's personalize layer.
 */
function GIIndicator({ glycemic, diabeticMode }: { glycemic: number; diabeticMode: boolean }) {
  if (!diabeticMode) return null;
  const isHigh = glycemic > 0.5;
  const isLow = glycemic < 0.1;
  if (!isHigh && !isLow) return null;
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={{ type: 'spring', stiffness: 380, damping: 22 }}
      className="gi-chip"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        padding: '2px 6px',
        borderRadius: 999,
        fontFamily: 'Inter',
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: '0.02em',
        background: isHigh ? 'rgba(201, 98, 45, 0.16)' : 'rgba(122, 140, 79, 0.18)',
        color: isHigh ? '#A14B22' : '#4F6630',
        border: isHigh
          ? '1px solid rgba(201, 98, 45, 0.40)'
          : '1px solid rgba(122, 140, 79, 0.45)',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
      title={`Glycemic share ${(glycemic * 100).toFixed(0)}% — ${isHigh ? 'high-GI, may spike blood sugar' : 'low-GI, gentle on blood sugar'}`}
    >
      {isHigh ? '↑ high-GI' : '↓ low-GI'}
    </motion.span>
  );
}

interface ResultsScreenProps {
  detected?: DetectedItem[];
  onChangeDetected?: (next: DetectedItem[]) => void;
  onViewNutrients?: () => void;
  profile?: UserProfile;
}

export default function ResultsScreen({
  detected: detectedProp,
  onChangeDetected,
  onViewNutrients,
  profile,
}: ResultsScreenProps) {
  const [detected, setDetected] = useState(detectedProp ?? []);
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [sortKey, setSortKey] = useState<typeof SORT_OPTIONS[number]['key']>('conf');
  const [step, setStep] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [multiSelect, setMultiSelect] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ msg: string; action?: { label: string; onClick: () => void } } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const diabeticMode = !!profile?.goals.diabetic;

  // Sync local → parent so Nutrients recomputes when grams change
  const updateDetected = (updater: DetectedItem[] | ((prev: DetectedItem[]) => DetectedItem[])) => {
    setDetected((prev) => {
      const next = typeof updater === 'function' ? (updater as (p: DetectedItem[]) => DetectedItem[])(prev) : updater;
      onChangeDetected?.(next);
      return next;
    });
  };

  // Sync prop in case App resets (e.g. retake)
  useEffect(() => {
    if (detectedProp && JSON.stringify(detectedProp) !== JSON.stringify(detected)) {
      setDetected(detectedProp);
      setConfirmed({});
      setStep(0);
      setEditMode(false);
      setMultiSelect(false);
      setSelected({});
      setSheetOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(detectedProp)]);

  const totals = useMemo(() => totalsFor(detected), [detected]);

  const sorted = useMemo(() => {
    const arr = [...detected];
    arr.sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name);
      if (sortKey === 'grams') return b.grams - a.grams;
      if (sortKey === 'kcal') {
        const ka = (NUTRITION_DB[a.name]?.kcal ?? 0) * a.grams;
        const kb = (NUTRITION_DB[b.name]?.kcal ?? 0) * b.grams;
        return kb - ka;
      }
      return b.confidence - a.confidence;
    });
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detected, sortKey]);

  const allConfirmed =
    detected.length > 0 && detected.every((d) => confirmed[d.name]);
  const sheetShownRef = useRef(false);
  useEffect(() => {
    if (allConfirmed && !sheetShownRef.current) {
      sheetShownRef.current = true;
      setSheetOpen(true);
    }
    if (!allConfirmed) sheetShownRef.current = false;
  }, [allConfirmed]);

  const triggerToast = (msg: string, action?: { label: string; onClick: () => void }) => {
    setToast({ msg, ...(action ? { action } : {}) });
    setTimeout(() => setToast(null), 2200);
  };

  const confirm = (name: string) => {
    setConfirmed((c) => ({ ...c, [name]: true }));
    triggerToast(`Confirmed ${name}`);
  };

  const remove = (name: string) => {
    const removed = detected.find((d) => d.name === name);
    updateDetected((rows) => rows.filter((r) => r.name !== name));
    setConfirmed((c) => {
      const next = { ...c };
      delete next[name];
      return next;
    });
    triggerToast(`Removed ${name}`, {
      label: 'Undo',
      onClick: () => {
        if (!removed) return;
        updateDetected((rows) => [...rows, removed]);
      },
    });
  };

  const setGrams = (name: string, deltaOrAbsolute: number, absolute?: boolean) => {
    updateDetected((rows) =>
      rows.map((r) => {
        if (r.name !== name) return r;
        const next = absolute ? deltaOrAbsolute : r.grams + deltaOrAbsolute;
        return { ...r, grams: Math.max(5, Math.min(800, next)) };
      }),
    );
  };

  const replaceName = (oldName: string, newName: string) => {
    if (!newName || newName === oldName) return;
    updateDetected((rows) =>
      rows.map((r) => (r.name === oldName ? { ...r, name: newName } : r)),
    );
    setConfirmed((c) => {
      const next = { ...c };
      if (next[oldName]) {
        next[newName] = next[oldName];
        delete next[oldName];
      }
      return next;
    });
  };

  const addPairing = (_existingName: string, pairingName: string) => {
    const meta = HISTORY_SUGGESTIONS.find((h: { name: string }) => h.name === pairingName);
    if (!meta) return;
    if (detected.some((d) => d.name === meta.name)) {
      triggerToast(`${meta.name} already in list`);
      return;
    }
    updateDetected((rows) => [
      ...rows,
      { name: meta.name, confidence: meta.confidence, grams: meta.grams, note: null },
    ]);
    triggerToast(`Added ${meta.name}`);
  };

  const addCustom = () => {
    const name = window.prompt('Add a custom item', 'Naan');
    if (!name) return;
    const grams = Number(window.prompt('Portion in grams', '60') || 60);
    if (detected.some((d) => d.name === name)) {
      triggerToast(`${name} already in list`);
      return;
    }
    updateDetected((rows) => [
      ...rows,
      { name, confidence: 100, grams: Math.max(5, Math.min(800, grams)), note: null },
    ]);
    triggerToast(`Added ${name}`);
  };

  const onLongPressRow = (name: string) => {
    if (editMode) return;
    setMultiSelect(true);
    setSelected({ [name]: true });
  };

  const onConfirmAllSelected = () => {
    const next = { ...confirmed };
    Object.keys(selected).forEach((n) => {
      const item = detected.find((d) => d.name === n);
      if (item && item.confidence >= 60) next[n] = true;
    });
    setConfirmed(next);
    triggerToast('Confirmed selected');
    setMultiSelect(false);
    setSelected({});
  };

  const onReviewAllSelected = () => {
    setStep(1);
    setMultiSelect(false);
    setSelected({});
  };

  const onCancelMulti = () => {
    setMultiSelect(false);
    setSelected({});
  };

  const onShare = () => {
    const lines = detected
      .map((d, i) => `${i + 1}. ${d.name} — ${d.grams}g (${d.confidence}%)`)
      .join('\n');
    if (navigator?.clipboard) navigator.clipboard.writeText(lines).catch(() => {});
    triggerToast('Copied to clipboard');
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;
  const hasHighConfSelected = Object.keys(selected).some((n) => {
    const it = detected.find((d) => d.name === n);
    return it && it.confidence >= 60;
  });

  const visibleItems = step === 1
    ? sorted.filter((it) => it.confidence < 80)
    : sorted;

  return (
    <div style={{ padding: '12px 16px 0', position: 'relative' }}>
      <div
        style={{
          position: 'sticky',
          top: -8,
          zIndex: 3,
          paddingTop: 4,
          paddingBottom: 8,
          background: 'linear-gradient(180deg, var(--bg-gradient-end) 0%, rgba(249,242,228,0) 100%)',
          marginInline: -16,
          paddingInline: 16,
        }}
      >
        <PhotoThumb />
        <StepIndicator step={step} onStep={setStep} />
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: 'Inter',
              fontSize: 22,
              fontWeight: 600,
              color: T.ink,
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            Detected items
          </h2>
          <p
            style={{
              fontFamily: 'Inter',
              fontSize: 12,
              color: T.inkSoft,
              margin: '2px 0 0',
            }}
          >
            {detected.length} item{detected.length === 1 ? '' : 's'} · {Math.round(totals.kcal)} kcal
          </p>
        </div>
        <motion.button
          type="button"
          onClick={() => {
            setEditMode((v) => !v);
            setMultiSelect(false);
            setSelected({});
          }}
          whileHover={{ y: -1, scale: 1.04 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 380, damping: 22 }}
          aria-pressed={editMode}
          aria-label={editMode ? 'Exit edit mode' : 'Enter edit mode'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 10px',
            borderRadius: 999,
            background: editMode ? T.primary : 'rgba(249, 242, 228, 0.75)',
            border: editMode ? 'none' : '1px solid rgba(74, 58, 52, 0.18)',
            fontFamily: 'Inter',
            fontSize: 11,
            fontWeight: 600,
            color: editMode ? '#FFFFFF' : T.ink,
            cursor: 'pointer',
            minHeight: 32,
          }}
        >
          <Edit3 size={11} /> {editMode ? 'Done' : 'Edit'}
        </motion.button>
      </div>

      <SummaryCard totals={totals} itemCount={detected.length} />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <SortMenu value={sortKey} onChange={setSortKey} />
          {diabeticMode && (
            <span
              className="tnum"
              style={{
                fontFamily: 'Inter',
                fontSize: 10,
                fontWeight: 600,
                color: T.inkSoft,
                background: 'rgba(74, 58, 52, 0.08)',
                padding: '3px 7px',
                borderRadius: 999,
                letterSpacing: '0.02em',
              }}
              title="Re-ranked for your diabetic profile"
            >
              ✓ re-ranked
            </span>
          )}
          <motion.button
            type="button"
            onClick={onShare}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 380, damping: 22 }}
            aria-label="Share detected items"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              background: 'transparent',
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
        </div>

        <motion.button
          type="button"
          onClick={addCustom}
          whileHover={{ scale: 1.08, rotate: 90 }}
          whileTap={{ scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 380, damping: 22 }}
          aria-label="Add custom item"
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: T.primary,
            border: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
            boxShadow: `0 4px 10px -3px ${T.primary}66`,
          }}
        >
          <Plus size={14} color="#FFFFFF" strokeWidth={2.5} />
        </motion.button>
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        layout
        style={{
          position: 'relative',
          paddingBottom: multiSelect ? 100 : 16,
        }}
      >
        <AnimatePresence initial={false}>
          {visibleItems.map((it) => {
            const meta = NUTRITION_DB[it.name];
            return (
              <div key={it.name} style={{ position: 'relative' }}>
                {diabeticMode && meta && (
                  <div style={{ position: 'absolute', right: 70, top: 14, zIndex: 2 }}>
                    <GIIndicator glycemic={meta.glycemic} diabeticMode={diabeticMode} />
                  </div>
                )}
                <ExpandableRow
                  item={it}
                  isConfirmed={!!confirmed[it.name]}
                  isSelected={!!selected[it.name]}
                  multiSelect={multiSelect}
                  editMode={editMode}
                  onConfirm={confirm}
                  onRemove={remove}
                  onGramsChange={setGrams}
                  onLongPress={onLongPressRow}
                  onRename={replaceName}
                  onReplace={(oldName, altName) => replaceName(oldName, altName)}
                  onAddPairing={addPairing}
                />
              </div>
            );
          })}
        </AnimatePresence>

        {step === 0 && !multiSelect && detected.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            style={{ marginTop: 14 }}
          >
            <div
              style={{
                fontFamily: 'Inter',
                fontSize: 11,
                fontWeight: 600,
                color: T.inkSoft,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 8,
              }}
            >
              Frequently eaten with this
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {HISTORY_SUGGESTIONS.map((h: { name: string; emoji: string; confidence: number; grams: number }) => (
                <motion.button
                  key={h.name}
                  type="button"
                  onClick={() => {
                    if (detected.some((d) => d.name === h.name)) {
                      triggerToast(`${h.name} already added`);
                      return;
                    }
                    updateDetected((rows) => [
                      ...rows,
                      { name: h.name, confidence: h.confidence, grams: h.grams, note: null },
                    ]);
                    triggerToast(`Added ${h.name}`);
                  }}
                  whileHover={{ y: -1, scale: 1.03 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                  aria-label={`Add ${h.name} from history`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '6px 10px',
                    borderRadius: 999,
                    background: 'rgba(249, 242, 228, 0.75)',
                    border: '1px solid rgba(74, 58, 52, 0.18)',
                    fontFamily: 'Inter',
                    fontSize: 11,
                    fontWeight: 600,
                    color: T.ink,
                    cursor: 'pointer',
                    minHeight: 32,
                  }}
                >
                  {h.emoji} Add {h.name}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {visibleItems.length === 0 && (
          <div
            style={{
              padding: '32px 16px',
              textAlign: 'center',
              color: T.inkSoft,
              fontFamily: 'Inter',
              fontSize: 13,
            }}
          >
            No items to review. Tap + to add a custom item.
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {multiSelect && (
          <BulkActionBar
            count={selectedCount}
            hasHighConf={hasHighConfSelected}
            onConfirmAll={onConfirmAllSelected}
            onReviewAll={onReviewAllSelected}
            onAddCustom={addCustom}
            onCancel={onCancelMulti}
          />
        )}
      </AnimatePresence>

      <SmartActionSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onViewNutrients={() => {
          setSheetOpen(false);
          onViewNutrients?.();
        }}
        onEditMeal={() => {
          setSheetOpen(false);
          setEditMode(true);
        }}
        onDiscard={() => {
          setSheetOpen(false);
          setConfirmed({});
        }}
      />

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
              left: 16,
              right: 16,
              bottom: 100,
              padding: '10px 14px',
              borderRadius: 14,
              background: T.primary,
              color: '#FFFFFF',
              fontFamily: 'Inter',
              fontSize: 12,
              fontWeight: 600,
              textAlign: 'center',
              boxShadow: '0 8px 24px rgba(46, 37, 34, 0.25)',
              zIndex: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <span style={{ flex: 1 }}>{toast.msg}</span>
            {toast.action && (
              <motion.button
                type="button"
                onClick={() => {
                  toast.action?.onClick();
                  setToast(null);
                }}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.94 }}
                transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                style={{
                  background: 'rgba(249, 242, 228, 0.2)',
                  color: '#FFFFFF',
                  border: '1px solid rgba(249, 242, 228, 0.4)',
                  borderRadius: 8,
                  padding: '4px 10px',
                  fontFamily: 'Inter',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {toast.action.label}
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}