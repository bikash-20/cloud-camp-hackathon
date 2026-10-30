import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Send,
  Image as ImageIcon,
  X,
  Sparkles,
  ShieldAlert,
  Compass,
  CheckCircle,
} from 'lucide-react';
import katex from 'katex';
import { T } from '../../data';
import { sendCoachChat } from '../../lib/api';
import { LocalizedContent, useLanguage } from '../../i18n/LanguageContext';
import type {
  CoachAgentType,
  CoachMessage,
  UserProfile,
} from '../../types/schemas';

interface CoachScreenProps {
  profile: UserProfile;
}

/**
 * Render LaTeX formula via KaTeX to HTML string.
 */
function renderLatexSpan(math: string, displayMode: boolean = false): string {
  try {
    return katex.renderToString(math, {
      displayMode,
      throwOnError: false,
      output: 'htmlAndMathml',
    });
  } catch {
    return math;
  }
}

/**
 * Lightweight helper to parse inline tokens:
 * - Block LaTeX: $$...$$
 * - Inline LaTeX: $...$
 * - Bold text: **text**
 * - Citations: [উৎস:...] or [Source:...]
 */
function parseFormattedInline(text: string, isUser: boolean) {
  const tokenRegex = /(\$\$[\s\S]+?\$\$|\$(?!\s)[^$\n]+?(?<!\s)\$|\*\*[\s\S]+?\*\*|\[(?:উৎস|Source):[^\]]+\])/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, index) => {
    if (!part) return null;

    // Display LaTeX ($$...$$)
    if (part.startsWith('$$') && part.endsWith('$$') && part.length >= 4) {
      const math = part.slice(2, -2).trim();
      const html = renderLatexSpan(math, true);
      return (
        <span
          key={index}
          style={{
            display: 'block',
            margin: '8px 0',
            overflowX: 'auto',
            textAlign: 'center',
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }

    // Inline LaTeX ($...$)
    if (part.startsWith('$') && part.endsWith('$') && part.length >= 3 && !part.startsWith('$$')) {
      const math = part.slice(1, -1).trim();
      const html = renderLatexSpan(math, false);
      return (
        <span
          key={index}
          style={{ display: 'inline-block', padding: '0 2px' }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }

    // Bold text (**...**)
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      const boldContent = part.slice(2, -2);
      return (
        <strong
          key={index}
          style={{
            fontWeight: 600,
            color: isUser ? '#FFFFFF' : '#241B18',
          }}
        >
          {boldContent}
        </strong>
      );
    }

    // Clinical citations ([উৎস: ...] or [Source: ...])
    if (part.startsWith('[') && part.endsWith(']')) {
      return (
        <span
          key={index}
          style={{
            display: 'inline-block',
            fontSize: 'var(--text-xs)',
            padding: '2px 8px',
            borderRadius: 6,
            margin: '2px 0',
            backgroundColor: isUser ? 'rgba(255,255,255,0.2)' : 'rgba(74, 58, 52, 0.08)',
            color: isUser ? '#FFFFFF' : '#4A3A34',
            fontWeight: 500,
          }}
        >
          {part}
        </span>
      );
    }

    return <span key={index}>{part}</span>;
  });
}

/**
 * Formatted message component supporting:
 * - Paragraphs separated by blank lines
 * - Bullet lists (•, -, *)
 * - Numbered lists (1., 2.)
 * - KaTeX math ($...$ and $$...$$)
 * - Bold text and clinical citations
 */
function FormattedMessage({ content, isUser }: { content: string; isUser: boolean }) {
  if (!content) return null;

  const blocks = content.split(/\n\n+/);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {blocks.map((block, bIdx) => {
        const rawLines = block.split('\n').filter((l) => l.trim().length > 0);
        const isBulletList =
          rawLines.length > 0 &&
          rawLines.every((l) => /^([•\-*]|\d+\.)\s/.test(l.trim()));

        if (isBulletList) {
          return (
            <ul
              key={bIdx}
              style={{
                listStyle: 'none',
                margin: '4px 0',
                paddingLeft: 4,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {rawLines.map((line, lIdx) => {
                const cleanLine = line.trim().replace(/^([•\-*]|\d+\.)\s*/, '');
                return (
                  <li
                    key={lIdx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      lineHeight: 1.6,
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        marginTop: 7,
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        flexShrink: 0,
                        backgroundColor: isUser ? 'rgba(255,255,255,0.85)' : '#4A3A34',
                      }}
                    />
                    <span style={{ flex: 1 }}>{parseFormattedInline(cleanLine, isUser)}</span>
                  </li>
                );
              })}
            </ul>
          );
        }

        return (
          <p key={bIdx} style={{ margin: 0, lineHeight: 1.65 }}>
            {rawLines.map((line, lIdx) => (
              <span
                key={lIdx}
                style={{
                  display: lIdx > 0 ? 'block' : 'inline',
                  marginTop: lIdx > 0 ? 4 : 0,
                }}
              >
                {parseFormattedInline(line, isUser)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

export default function CoachScreen({ profile }: CoachScreenProps) {
  const { language } = useLanguage();
  const isBn = language === 'bn';

  const [agentType, setAgentType] = useState<CoachAgentType>('scientist');
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([]);
  const [citations, setCitations] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Synchronize persona and welcome message with the active language
  useEffect(() => {
    if (agentType === 'scientist') {
      const welcome: CoachMessage = {
        role: 'assistant',
        content: isBn
          ? '🔬 **স্বাগতম! আমি ড. সুস্মিত (Dr. Susmit - পুষ্টি বিজ্ঞানী)।**\n\n' +
            'আপনার খাদ্যের গ্লাইসেমিক সূচক (GI/GL), রান্নার তেলের প্রভাব, পুষ্টি উপাদান এবং বিপি/ডায়াবেটিসের বৈজ্ঞানিক বিশ্লেষণ জানাতে আমি প্রস্তুত। যেকোনো প্রশ্ন নির্বাচন করুন বা সরাসরি জিজ্ঞাসা করুন!'
          : '🔬 **Welcome! I am Dr. Susmit (Nutritional Biochemist).**\n\n' +
            'I provide evidence-based biochemical analysis of your meals, glycemic load ($GL$), cooking oil absorption, and clinical macronutrient partitioning per BIRDEM/ADA guidelines. Ask any nutrition question!',
      };
      setMessages([welcome]);
      setSuggestedPrompts(
        isBn
          ? [
              'এই খাবারের গ্লাইসেমিক লোড কীভাবে কমাব?',
              'রান্নায় তেল শোষণ কমানোর বৈজ্ঞানিক পদ্ধতি কী?',
              'বাজেট ফ্রেন্ডলি প্রোটিন উৎস কী কী?',
            ]
          : [
              'How do I lower the glycemic load of this meal?',
              'How to reduce cooking oil absorption?',
              'What are budget-friendly protein sources?',
            ]
      );
      setCitations(isBn ? ['BIRDEM ক্লিনিক্যাল গাইডলাইন', 'INFS খাদ্য ডাটাবেজ'] : ['BIRDEM Clinical Protocols', 'INFS Nutrition DB']);
    } else {
      const welcome: CoachMessage = {
        role: 'assistant',
        content: isBn
          ? '🧠 **হ্যালো! আমি ফারহানা আহমেদ (আচরণ ও অভ্যাস কোচ)।**\n\n' +
            'সুস্থ জীবনযাপন কোনো চাপ বা কড়া ডায়েট নয়, বরং ভালো লাগার অভ্যাস। পারিবারিক দাওয়াত, মিষ্টির ক্রেভিং বা রুটিন ধরে রাখার সহজ মনস্তাত্ত্বিক পরামর্শ পেতে আমাকে জানাতে পারেন। কোনো অপরাধবোধ ছাড়াই আমরা এগিয়ে যাব! 💚'
          : '🧠 **Hello! I am Farhana Ahmed (Behavioral & Habit Coach).**\n\n' +
            'Healthy living isn\'t about rigid restrictions or guilt—it\'s about building compassionate, lasting habits. Let\'s navigate family feasts, sweet cravings, and daily routines together! 💚',
      };
      setMessages([welcome]);
      setSuggestedPrompts(
        isBn
          ? [
              'দাওয়াতে অতিরিক্ত খাওয়ার পর কী করব?',
              'রাতের মিষ্টি বা চায়ের আড্ডার লোভ কীভাবে সামলাব?',
              'ব্যস্ত দিনে হেলদি ডায়েট ধরে রাখার সহজ রুটিন কী?',
            ]
          : [
              'How to bounce back after a heavy family feast?',
              'How to manage evening sweet cravings?',
              'Easy routines for healthy habits on busy days?',
            ]
      );
      setCitations(isBn ? ['CBT আচরণ বিজ্ঞান', 'WHO লাইফস্টাইল গাইডলাইন'] : ['CBT Habit Science', 'WHO Lifestyle Protocols']);
    }
  }, [agentType, isBn]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImagePreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const content = (textToSend ?? input).trim();
    if (!content && !imagePreview) return;

    const userMsg: CoachMessage = {
      role: 'user',
      content,
      image_ref: imagePreview,
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setImagePreview(null);
    setLoading(true);

    try {
      const historyToSend = messages.map((m) => ({
        role: m.role,
        content: m.content,
        image_ref: m.image_ref,
      }));

      const res = await sendCoachChat({
        message: content,
        history: historyToSend,
        messages: nextMessages,
        agent_type: agentType,
        user_profile: profile,
        lang: language,
      });

      const assistantMsg: CoachMessage = {
        role: 'assistant',
        content: res.reply,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      if (res.suggested_prompts && res.suggested_prompts.length > 0) {
        setSuggestedPrompts(res.suggested_prompts);
      }
      if (res.citations && res.citations.length > 0) {
        setCitations(res.citations);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: isBn
            ? 'দুঃখিত, এই মুহূর্তে উত্তর তৈরিতে কিছুটা সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।'
            : 'Sorry, unable to process the request right now. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LocalizedContent>
      {/* Root Layout Container with guaranteed 130px bottom dock clearance */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 130 }}>
        {/* Header Title & Persona Switcher */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2
                style={{
                  fontSize: 'var(--text-lg)',
                  fontWeight: 600,
                  color: T.primary,
                  margin: 0,
                  letterSpacing: '-0.02em',
                }}
              >
                {isBn ? 'মাল্টি-এজেন্ট AI কোচ' : 'Multi-Agent AI Coach'}
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: T.inkSoft }}>
                {isBn
                  ? 'বিজ্ঞানসম্মত পুষ্টি বিশ্লেষণ ও সহানুভূতিশীল আচরণ নির্দেশিকা'
                  : 'Grounded biochemical science and empathetic behavioral coaching'}
              </p>
            </div>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: agentType === 'scientist' ? 'rgba(74, 58, 52, 0.12)' : 'rgba(78, 124, 76, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: agentType === 'scientist' ? T.primary : '#2E6333',
              }}
            >
              <Bot size={20} />
            </div>
          </div>

          {/* Dual-Agent Selector Toggle */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
              background: 'rgba(255, 255, 255, 0.65)',
              padding: 4,
              borderRadius: 16,
              border: `1px solid ${T.cardBorder}`,
            }}
          >
            <motion.button
              type="button"
              onClick={() => setAgentType('scientist')}
              whileTap={{ scale: 0.98 }}
              style={{
                padding: '8px 12px',
                borderRadius: 12,
                border: 'none',
                background: agentType === 'scientist' ? T.primary : 'transparent',
                color: agentType === 'scientist' ? '#FFFFFF' : T.ink,
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'background 200ms ease, color 200ms ease',
              }}
            >
              <span>🔬</span>
              <span>{isBn ? 'ড. সুস্মিত (বিজ্ঞানী)' : 'Dr. Susmit (Scientist)'}</span>
            </motion.button>

            <motion.button
              type="button"
              onClick={() => setAgentType('coach')}
              whileTap={{ scale: 0.98 }}
              style={{
                padding: '8px 12px',
                borderRadius: 12,
                border: 'none',
                background: agentType !== 'scientist' ? '#2E6333' : 'transparent',
                color: agentType !== 'scientist' ? '#FFFFFF' : T.ink,
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'background 200ms ease, color 200ms ease',
              }}
            >
              <span>🧠</span>
              <span>{isBn ? 'আচরণ কোচ' : 'Habit Coach'}</span>
            </motion.button>
          </div>
        </div>

        {/* Clinical Disclaimer Banner */}
        <div
          style={{
            padding: '8px 12px',
            borderRadius: 12,
            background: 'rgba(197, 85, 59, 0.08)',
            border: '1px solid rgba(197, 85, 59, 0.20)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 'var(--text-xs)',
            color: '#A8432A',
            lineHeight: 1.4,
          }}
        >
          <ShieldAlert size={14} style={{ flexShrink: 0 }} />
          <span>
            {isBn
              ? '⚠️ এআই কোচের পরামর্শ তথ্যমূলক ও শিক্ষামূলক, কোনো চিকিৎসাগত প্রেসক্রিপশন বা বিকল্প নয়।'
              : '⚠️ AI Coach guidance is informational and educational; consult a physician for clinical diagnoses.'}
          </span>
        </div>

        {/* Chat Thread Messages */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            minHeight: 320,
            maxHeight: 460,
            overflowY: 'auto',
            padding: '8px 4px',
          }}
        >
          {messages.map((m, idx) => {
            const isUser = m.role === 'user';
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isUser ? 'flex-end' : 'flex-start',
                  gap: 4,
                  width: '100%',
                }}
              >
                {/* Sender badge */}
                <div
                  style={{
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                    color: T.inkSoft,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '0 4px',
                  }}
                >
                  {isUser ? (
                    <span>{profile.name || (isBn ? 'আপনি' : 'You')}</span>
                  ) : agentType === 'scientist' ? (
                    <>
                      <span style={{ fontWeight: 600, color: T.primary }}>
                        🔬 {isBn ? 'ড. সুস্মিত (পুষ্টি বিজ্ঞানী)' : 'Dr. Susmit (Scientist)'}
                      </span>
                      <span style={{ opacity: 0.7 }}>• BIRDEM / ADA</span>
                    </>
                  ) : (
                    <>
                      <span style={{ fontWeight: 600, color: '#2E6333' }}>
                        🧠 {isBn ? 'ফারহানা আহমেদ (আচরণ কোচ)' : 'Habit Coach (Behavioral)'}
                      </span>
                      <span style={{ opacity: 0.7 }}>• CBT & Habits</span>
                    </>
                  )}
                </div>

                {/* Message Bubble — Box-Model Guaranteed */}
                <div
                  className={isUser ? 'coach-bubble-user' : 'coach-bubble-assistant'}
                  style={
                    isUser
                      ? {
                          padding: '10px 16px',
                          borderRadius: '16px 16px 4px 16px',
                          backgroundColor: '#3D2E27',
                          color: '#F9F5F0',
                          fontSize: '0.9375rem',
                          lineHeight: 1.5,
                          minWidth: '48px',
                          display: 'inline-block',
                          wordBreak: 'break-word',
                          maxWidth: '88%',
                        }
                      : {
                          maxWidth: '88%',
                          padding: '16px 20px',
                          borderRadius: '16px 16px 16px 4px',
                          backgroundColor: '#FFFFFF',
                          border: '1px solid rgba(92, 64, 51, 0.12)',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                          fontSize: '0.9375rem',
                          lineHeight: 1.65,
                          color: '#2C221E',
                          wordBreak: 'break-word',
                        }
                  }
                >
                  {m.image_ref && (
                    <div style={{ marginBottom: 10, borderRadius: 10, overflow: 'hidden' }}>
                      <img
                        src={m.image_ref}
                        alt="Dish upload"
                        style={{ width: '100%', maxHeight: 200, objectFit: 'cover' }}
                      />
                    </div>
                  )}
                  <FormattedMessage content={m.content} isUser={isUser} />
                </div>
              </motion.div>
            );
          })}

          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 14px',
                borderRadius: 14,
                background: 'rgba(255, 255, 255, 0.85)',
                width: 'fit-content',
                fontSize: 'var(--text-xs)',
                color: T.inkSoft,
              }}
            >
              <Sparkles size={14} className="animate-spin" color={T.primary} />
              <span>
                {agentType === 'scientist'
                  ? isBn
                    ? 'বায়োকেমিক্যাল ও পুষ্টি তথ্য বিশ্লেষণ হচ্ছে…'
                    : 'Analyzing biochemical pathways & nutrition data…'
                  : isBn
                  ? 'সহানুভূতিশীল পরামর্শ সাজানো হচ্ছে…'
                  : 'Formulating habit guidance…'}
              </span>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Domain Citation Badges */}
        {citations.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: T.inkSoft, fontWeight: 600 }}>
              {isBn ? 'স্বীকৃত তথ্যসূত্র:' : 'Official Citations:'}
            </span>
            {citations.map((c, i) => (
              <span
                key={i}
                style={{
                  fontSize: 'var(--text-xs)',
                  padding: '3px 8px',
                  borderRadius: 8,
                  background: 'rgba(74, 58, 52, 0.08)',
                  color: T.ink,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <CheckCircle size={11} color="#2E6333" />
                {c}
              </span>
            ))}
          </div>
        )}

        {/* Contextual Suggested Prompt Chips */}
        {suggestedPrompts.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                color: T.inkSoft,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Compass size={12} />
              <span>{isBn ? 'সংশ্লিষ্ট জিজ্ঞাসা (ট্যাপ করে প্রশ্ন করুন):' : 'Suggested Prompts (Tap to ask):'}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
              {suggestedPrompts.map((p, idx) => (
                <motion.button
                  key={idx}
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => handleSendMessage(p)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 20,
                    background: 'rgba(255, 255, 255, 0.90)',
                    border: `1px solid ${T.cardBorder}`,
                    color: T.ink,
                    fontSize: 'var(--text-sm)',
                    lineHeight: 1.4,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
                  }}
                >
                  {p}
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Image Attachment Preview */}
        <AnimatePresence>
          {imagePreview && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: 6,
                background: 'rgba(255,255,255,0.9)',
                borderRadius: 12,
                border: `1px solid ${T.cardBorder}`,
                width: 'fit-content',
              }}
            >
              <img
                src={imagePreview}
                alt="Upload preview"
                style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover' }}
              />
              <span style={{ fontSize: 'var(--text-xs)', color: T.ink }}>
                {isBn ? 'খাবারের ছবি যুক্ত করা হয়েছে' : 'Dish photo attached'}
              </span>
              <button
                type="button"
                onClick={() => setImagePreview(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                  color: T.inkSoft,
                }}
              >
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input Bar with Attachment and Send */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(255, 255, 255, 0.95)',
            padding: '6px 12px',
            borderRadius: 24,
            border: `1px solid ${T.cardBorder}`,
            boxShadow: '0 4px 16px rgba(46, 37, 34, 0.08)',
          }}
        >
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageSelect}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach photo"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: T.inkSoft,
              padding: 6,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ImageIcon size={18} />
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={
              agentType === 'scientist'
                ? isBn
                  ? 'পুষ্টি বা উপাদান সম্পর্কে জিজ্ঞাসা করুন…'
                  : 'Ask about glycemic load, oil, sodium…'
                : isBn
                ? 'দাওয়াত বা অভ্যাস সম্পর্কে জিজ্ঞাসা করুন…'
                : 'Ask about feasts, cravings, habits…'
            }
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 'var(--text-base)',
              color: T.ink,
              padding: '6px 8px',
            }}
          />

          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => handleSendMessage()}
            disabled={loading || (!input.trim() && !imagePreview)}
            aria-label="Send message"
            style={{
              background: !input.trim() && !imagePreview ? 'rgba(74, 58, 52, 0.25)' : T.primary,
              border: 'none',
              borderRadius: '50%',
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              cursor: !input.trim() && !imagePreview ? 'default' : 'pointer',
              transition: 'background 180ms ease',
            }}
          >
            <Send size={15} />
          </motion.button>
        </div>
      </div>
    </LocalizedContent>
  );
}
