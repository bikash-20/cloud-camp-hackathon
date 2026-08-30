import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Plus, Share2, Trash2, X } from 'lucide-react';
import { T } from '../../data';
import type { GroceryItem, GroceryList, UserProfile } from '../../types/schemas';
import {
  addGroceryItem as apiAddItem,
  getGroceryList,
  removeGroceryItem as apiRemoveItem,
  toggleGroceryItem as apiToggle,
  updateGroceryPrice as apiUpdatePrice,
} from '../../lib/api';
import ConfidenceRing from '../ConfidenceRing';
import SectionLabel from '../SectionLabel';

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};

const group: import('framer-motion').Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as unknown as 'easeOut' } },
};

interface DisplayGroup {
  cat: string;
  items: GroceryItem[];
}

interface GroceryScreenProps {
  profile: UserProfile;
}

export default function GroceryScreen({ profile }: GroceryScreenProps) {
  const [groups, setGroups] = useState<DisplayGroup[]>([]);
  const [budget, setBudget] = useState(profile.budget);
  const [toast, setToast] = useState<string | null>(null);
  const [addingAt, setAddingAt] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const nextIdRef = useRef(100);

  // Initial load + sync when profile.budget changes
  useEffect(() => {
    let cancelled = false;
    getGroceryList(profile).then((list: GroceryList) => {
      if (cancelled) return;
      setGroups(list.groups.map((g) => ({ cat: g.category, items: g.items })));
      setBudget(list.budget);
    });
    return () => { cancelled = true; };
  }, [profile]);

  const totalSpent = groups.reduce(
    (sum, g) => sum + g.items.filter((i) => i.checked).reduce((s, i) => s + i.price, 0),
    0,
  );
  const remaining = Math.max(0, budget - totalSpent);
  const pct = Math.min(100, Math.round((totalSpent / budget) * 100));
  const overBudget = totalSpent > budget;

  useEffect(() => {
    if (overBudget) {
      setToast(`Over budget by ৳${totalSpent - budget}`);
      const t = setTimeout(() => setToast(null), 1800);
      return () => clearTimeout(t);
    }
  }, [overBudget, totalSpent, budget]);

  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  const toggle = async (gid: string) => {
    setGroups((gs) =>
      gs.map((g) => ({
        ...g,
        items: g.items.map((i) =>
          i.id === gid ? { ...i, checked: !i.checked } : i,
        ),
      })),
    );
    await apiToggle(gid);
  };

  const remove = async (gid: string) => {
    setGroups((gs) =>
      gs.map((g) => ({ ...g, items: g.items.filter((i) => i.id !== gid) })),
    );
    await apiRemoveItem(gid);
  };

  const updatePrice = async (gid: string, price: number) => {
    setGroups((gs) =>
      gs.map((g) => ({
        ...g,
        items: g.items.map((i) =>
          i.id === gid ? { ...i, price: Math.max(0, Math.min(9999, price)) } : i,
        ),
      })),
    );
    await apiUpdatePrice(gid, price);
  };

  const addItem = async (gi: number, name: string, price: number) => {
    const localId = `custom-${nextIdRef.current++}`;
    const optimistic: GroceryItem = { id: localId, name, price, checked: false };
    setGroups((gs) =>
      gs.map((g, idx) =>
        idx === gi ? { ...g, items: [...g.items, optimistic] } : g,
      ),
    );
    setAddingAt(null);
    triggerToast(`Added ${name}`);
    // Backend reconciliation (mocked)
    await apiAddItem(groups[gi]?.cat ?? 'Other', name, price);
  };

  const shareList = () => {
    const lines = groups
      .flatMap((g) => g.items.map((i) => `${i.checked ? '✓' : '○'} ${i.name} — ৳${i.price}`))
      .join('\n');
    if (navigator?.clipboard) navigator.clipboard.writeText(lines).catch(() => {});
    triggerToast('List copied to clipboard');
  };

  return (
    <div style={{ padding: '20px 24px 0' }}>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 4,
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
          This week's list
        </h2>
        <ConfidenceRing
          value={pct}
          size={48}
          stroke={4}
          color={overBudget ? T.accentWarn : T.accentGood}
          delay={0.15}
        >
          <span
            className="tnum"
            style={{ fontSize: 9, fontFamily: 'Inter', fontWeight: 700 }}
          >
            {pct}%
          </span>
        </ConfidenceRing>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.08 }}
        style={{
          fontFamily: 'Inter',
          fontSize: 13,
          color: T.inkSoft,
          margin: '0 0 12px',
          lineHeight: 1.4,
        }}
      >
        <span className="tnum" style={{ fontWeight: 600 }}>
          ৳{totalSpent}
        </span>{' '}
        spent ·{' '}
        <span
          className="tnum"
          style={{
            fontWeight: 600,
            color: overBudget ? T.accentWarn : T.ink,
          }}
        >
          ৳{remaining}
        </span>{' '}
        left of ৳{budget}
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          marginBottom: 10,
        }}
      >
        <motion.button
          type="button"
          onClick={shareList}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 380, damping: 22 }}
          aria-label="Share grocery list"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            background: 'none',
            border: 'none',
            padding: '4px 6px',
            fontFamily: 'Inter',
            fontSize: 11.5,
            fontWeight: 600,
            color: T.primary,
            cursor: 'pointer',
          }}
        >
          <Share2 size={12} /> Share list
        </motion.button>
      </motion.div>

      <motion.div variants={container} initial="hidden" animate="show" layout>
        {groups.map((g, gi) => (
          <motion.div key={g.cat} variants={group} layout style={{ marginBottom: 18 }}>
            <SectionLabel
              action={addingAt === gi ? undefined : '+ Add'}
              onAction={() => setAddingAt(gi)}
            >
              {g.cat}
            </SectionLabel>

            <AnimatePresence initial={false}>
              {g.items.map((item) => {
                const isEditing = editingId === item.id;
                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -40, scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                    className="glass-card"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderRadius: 14,
                      padding: '10px 14px',
                      marginBottom: 8,
                      border: '1px solid rgba(74, 58, 52, 0.10)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                      <motion.button
                        type="button"
                        onClick={() => toggle(item.id)}
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.9 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                        aria-label={
                          item.checked
                            ? `Mark ${item.name} as needed`
                            : `Mark ${item.name} as bought`
                        }
                        aria-pressed={item.checked}
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 6,
                          background: item.checked ? T.primary : 'rgba(249, 242, 228, 0.7)',
                          border: item.checked
                            ? `1px solid ${T.primary}`
                            : '1px solid rgba(74, 58, 52, 0.25)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          cursor: 'pointer',
                          padding: 0,
                          boxShadow: item.checked
                            ? `0 4px 10px -3px ${T.primary}55`
                            : 'none',
                        }}
                      >
                        <AnimatePresence>
                          {item.checked && (
                            <motion.span
                              key="check"
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              transition={{ duration: 0.18 }}
                              style={{ display: 'inline-flex' }}
                            >
                              <Check size={14} color="#FFFFFF" strokeWidth={3} />
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </motion.button>

                      <span
                        style={{
                          fontFamily: 'Inter',
                          fontSize: 14,
                          color: item.checked ? T.inkSoft : T.ink,
                          fontWeight: item.checked ? 500 : 600,
                          textDecoration: item.checked ? 'line-through' : 'none',
                          textDecorationColor: T.inkSoft,
                          flex: 1,
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          transition: 'color 200ms ease',
                        }}
                      >
                        {item.name}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {isEditing ? (
                        <input
                          autoFocus
                          type="number"
                          value={item.price}
                          onChange={(e) => updatePrice(item.id, Number(e.target.value || 0))}
                          onBlur={() => setEditingId(null)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === 'Escape') setEditingId(null);
                          }}
                          aria-label={`Edit price for ${item.name}`}
                          style={{
                            width: 64,
                            fontFamily: "'Inter', sans-serif",
                            fontSize: 12,
                            fontWeight: 600,
                            color: T.ink,
                            background: 'rgba(249, 242, 228, 0.7)',
                            border: `1px solid ${T.primary}`,
                            borderRadius: 8,
                            padding: '4px 8px',
                            outline: 'none',
                            textAlign: 'right',
                          }}
                        />
                      ) : (
                        <motion.button
                          type="button"
                          onClick={() => setEditingId(item.id)}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.94 }}
                          transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                          aria-label={`Edit price of ${item.name}, currently ৳${item.price}`}
                          className="tnum"
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: '4px 6px',
                            fontFamily: "'Inter', sans-serif",
                            fontSize: 13,
                            color: item.checked ? T.inkSoft : T.ink,
                            fontWeight: 600,
                            cursor: 'pointer',
                            minHeight: 28,
                          }}
                        >
                          ৳{item.price}
                        </motion.button>
                      )}

                      <motion.button
                        type="button"
                        onClick={() => remove(item.id)}
                        whileHover={{ scale: 1.15, rotate: 90 }}
                        whileTap={{ scale: 0.9 }}
                        transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                        aria-label={`Remove ${item.name}`}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          background: 'rgba(74, 58, 52, 0.08)',
                          border: '1px solid rgba(74, 58, 52, 0.12)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        <Trash2 size={11} color={T.inkSoft} strokeWidth={2} />
                      </motion.button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            <AnimatePresence>
              {addingAt === gi && (
                <AddItemForm
                  onSubmit={(name, price) => addItem(gi, name, price)}
                  onCancel={() => setAddingAt(null)}
                />
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </motion.div>

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
              background: overBudget ? T.accentWarn : T.primary,
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

interface AddItemFormProps {
  onSubmit: (name: string, price: number) => void;
  onCancel: () => void;
}

function AddItemForm({ onSubmit, onCancel }: AddItemFormProps) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState(40);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = () => {
    if (!name.trim()) return;
    onSubmit(name.trim(), Math.max(0, Math.min(9999, price)));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 320, damping: 22 }}
      className="glass-card"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        borderRadius: 14,
        padding: '8px 10px',
        marginBottom: 8,
        border: `1px dashed ${T.primary}`,
      }}
    >
      <input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') onCancel();
        }}
        placeholder="Item name"
        aria-label="New item name"
        style={{
          flex: 1,
          minWidth: 0,
          fontFamily: 'Inter',
          fontSize: 13,
          color: T.ink,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          padding: '6px 4px',
        }}
      />
      <input
        type="number"
        value={price}
        onChange={(e) => setPrice(Number(e.target.value || 0))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') onCancel();
        }}
        aria-label="Price in taka"
        className="tnum"
        style={{
          width: 56,
          fontFamily: "'Inter', sans-serif",
          fontSize: 12,
          fontWeight: 600,
          color: T.ink,
          background: 'rgba(249, 242, 228, 0.7)',
          border: '1px solid rgba(74, 58, 52, 0.15)',
          borderRadius: 8,
          padding: '4px 6px',
          outline: 'none',
          textAlign: 'right',
        }}
      />
      <motion.button
        type="button"
        onClick={submit}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 400, damping: 18 }}
        aria-label="Add item"
        style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: T.primary,
          border: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          padding: 0,
          boxShadow: '0 4px 10px -3px rgba(46,37,34,0.45)',
        }}
      >
        <Plus size={14} color="#FFFFFF" strokeWidth={2.5} />
      </motion.button>
      <motion.button
        type="button"
        onClick={onCancel}
        whileHover={{ scale: 1.1, rotate: 90 }}
        whileTap={{ scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 380, damping: 22 }}
        aria-label="Cancel"
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: 'rgba(74, 58, 52, 0.08)',
          border: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <X size={12} color={T.inkSoft} strokeWidth={2.5} />
      </motion.button>
    </motion.div>
  );
}