import { useEffect, useRef, useState, useCallback } from 'react';
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
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Loader2,
} from 'lucide-react';
import katex from 'katex';
import { T } from '../../data';
import { useTokens } from '../../theme/useTokens';
import { sendCoachVoiceChat, generateCoachTTS } from '../../lib/api';
import { LocalizedContent, useLanguage } from '../../i18n/LanguageContext';
import type {
  CoachAgentType,
  CoachMessage,
  UserProfile,
} from '../../types/schemas';

interface DisplayCoachMessage extends CoachMessage {
  persona?: string;
  voice_summary?: string | null;
  audio_base64?: string | null;
  audio_mime_type?: string;
  use_browser_tts?: boolean;
  tts_diagnostic?: string | null;
}

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
function parseFormattedInline(text: string, isUser: boolean, isDark: boolean) {
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
            fontWeight: 700,
            color: isUser ? '#FFFFFF' : (isDark ? '#F9F2E4' : '#241B18'),
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
            backgroundColor: isUser
              ? 'rgba(255,255,255,0.2)'
              : (isDark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(74, 58, 52, 0.08)'),
            color: isUser
              ? '#FFFFFF'
              : (isDark ? '#E8C49A' : '#4A3A34'),
            fontWeight: 600,
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
 * - Bold text and clinical citations with adaptive contrast
 */
function FormattedMessage({
  content,
  isUser,
  isDark,
}: {
  content: string;
  isUser: boolean;
  isDark: boolean;
}) {
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
                        backgroundColor: isUser
                          ? 'rgba(255,255,255,0.85)'
                          : (isDark ? '#E8C49A' : '#4A3A34'),
                      }}
                    />
                    <span style={{ flex: 1 }}>{parseFormattedInline(cleanLine, isUser, isDark)}</span>
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
                {parseFormattedInline(line, isUser, isDark)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

export default function CoachScreen({ profile }: CoachScreenProps) {
  const { theme } = useTokens();
  const isDark = theme === 'dark';
  const { language } = useLanguage();
  const isBn = language === 'bn';

  const [agentType, setAgentType] = useState<CoachAgentType>('scientist');
  const [messages, setMessages] = useState<DisplayCoachMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([]);
  const [citations, setCitations] = useState<string[]>([]);

  // Voice Assistant Audio state
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [currentPlayingIndex, setCurrentPlayingIndex] = useState<number | null>(null);
  const [fetchingAudioId, setFetchingAudioId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Speech-to-Text state
  const [isListening, setIsListening] = useState(false);
  const [speechLang, setSpeechLang] = useState<'bn-BD' | 'en-US'>(() => (isBn ? 'bn-BD' : 'en-US'));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    setSpeechLang(isBn ? 'bn-BD' : 'en-US');
  }, [isBn]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlayingAudio(false);
    setCurrentPlayingIndex(null);
  }, []);

  const speakWithBrowserTTS = useCallback((text: string, idx?: number) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const clean = text
      .replace(/\[(?:উৎস|Source):[^\]]+\]/g, '')
      .replace(/[*#_`>]/g, '')
      .slice(0, 300);
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = language === 'bn' ? 'bn-BD' : 'en-US';
    utterance.rate = 1.0;
    if (idx !== undefined) {
      setCurrentPlayingIndex(idx);
      setIsPlayingAudio(true);
      utterance.onend = () => {
        setIsPlayingAudio(false);
        setCurrentPlayingIndex(null);
      };
      utterance.onerror = () => {
        setIsPlayingAudio(false);
        setCurrentPlayingIndex(null);
      };
    }
    window.speechSynthesis.speak(utterance);
  }, [language]);

  const playAudioForMessage = useCallback(async (idx: number, msg: DisplayCoachMessage) => {
    if (isPlayingAudio && currentPlayingIndex === idx) {
      stopAudio();
      return;
    }
    stopAudio();

    // 1. If audio bytes are already attached to this message, play immediately
    if (msg.audio_base64) {
      const mime = msg.audio_mime_type || 'audio/mpeg';
      const audio = new Audio(`data:${mime};base64,${msg.audio_base64}`);
      audioRef.current = audio;
      setCurrentPlayingIndex(idx);
      setIsPlayingAudio(true);
      audio.onended = () => {
        setIsPlayingAudio(false);
        setCurrentPlayingIndex(null);
      };
      audio.onerror = (e) => {
        console.warn('Audio playback error, falling back to browser TTS:', e);
        setIsPlayingAudio(false);
        setCurrentPlayingIndex(null);
        speakWithBrowserTTS(msg.voice_summary || msg.content, idx);
      };
      audio.play().catch((err) => {
        console.warn('audio.play() failed, falling back to browser TTS:', err);
        setIsPlayingAudio(false);
        setCurrentPlayingIndex(null);
        speakWithBrowserTTS(msg.voice_summary || msg.content, idx);
      });
      return;
    }

    // 2. Audio not yet loaded: Request ElevenLabs TTS from backend
    const textToSynthesize = msg.voice_summary || msg.content;
    if (!textToSynthesize) return;

    setFetchingAudioId(idx);
    try {
      const isBengaliText = /[\u0980-\u09FF]/.test(textToSynthesize) || language === 'bn';
      const targetPersona = msg.persona || agentType;
      const res = await generateCoachTTS({
        text: textToSynthesize,
        lang: isBengaliText ? 'bn' : 'en',
        persona: targetPersona,
      });

      console.info('[AI Coach TTS]', {
        index: idx,
        diagnostic: res.tts_diagnostic,
        useBrowserTTS: res.use_browser_tts,
        hasAudio: Boolean(res.audio_base64),
      });

      if (res.audio_base64) {
        // Cache audio on message in state so subsequent clicks don't re-fetch
        setMessages((prev) => {
          const next = [...prev];
          if (next[idx]) {
            next[idx] = {
              ...next[idx],
              audio_base64: res.audio_base64,
              audio_mime_type: res.audio_mime_type || 'audio/mpeg',
              use_browser_tts: false,
              tts_diagnostic: res.tts_diagnostic,
            };
          }
          return next;
        });

        const mime = res.audio_mime_type || 'audio/mpeg';
        const audio = new Audio(`data:${mime};base64,${res.audio_base64}`);
        audioRef.current = audio;
        setCurrentPlayingIndex(idx);
        setIsPlayingAudio(true);
        audio.onended = () => {
          setIsPlayingAudio(false);
          setCurrentPlayingIndex(null);
        };
        audio.onerror = () => {
          setIsPlayingAudio(false);
          setCurrentPlayingIndex(null);
          speakWithBrowserTTS(textToSynthesize, idx);
        };
        await audio.play();
      } else {
        // Audio generation was null (e.g. ElevenLabs error or browser fallback flag)
        speakWithBrowserTTS(textToSynthesize, idx);
      }
    } catch (err) {
      console.warn('generateCoachTTS call failed:', err);
      speakWithBrowserTTS(textToSynthesize, idx);
    } finally {
      setFetchingAudioId(null);
    }
  }, [isPlayingAudio, currentPlayingIndex, stopAudio, speakWithBrowserTTS, language, agentType]);

  // Cleanup speech/audio on unmount
  useEffect(() => {
    return () => {
      stopAudio();
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [stopAudio]);

  // Synchronize persona and welcome message with active language
  useEffect(() => {
    stopAudio();
    if (agentType === 'scientist') {
      const welcome: DisplayCoachMessage = {
        role: 'assistant',
        persona: 'scientist',
        content: isBn
          ? '🔬 **স্বাগতম! আমি ড. সুস্মিত (Dr. Susmit - পুষ্টি বিজ্ঞানী)।**\n\n' +
            'আপনার প্রোফাইল, আজকের খাদ্যতালিকা ও প্যান্ট্রির তথ্যের ভিত্তিতে গ্লাইসেমিক সূচক (GI/GL), রান্নার তেলের প্রভাব এবং বিপি/ডায়াবেটিসের বৈজ্ঞানিক বিশ্লেষণ জানাতে আমি প্রস্তুত। যেকোনো প্রশ্ন জিজ্ঞাসা করুন!'
          : '🔬 **Welcome! I am Dr. Susmit (Nutritional Biochemist).**\n\n' +
            'I provide evidence-based biochemical analysis grounded in your live profile, today\'s logged meals, and pantry items per BIRDEM/ADA clinical protocols. Ask any question via text or voice!',
        voice_summary: isBn
          ? 'স্বাগতম! আমি পুষ্টি বিজ্ঞানী ড. সুস্মিত। আপনার খাদ্যের গ্লাইসেমিক লোড ও পুষ্টির বৈজ্ঞানিক বিশ্লেষণে আমি সাহায্য করব।'
          : 'Welcome! I am Dr. Susmit. I provide evidence-based biochemical analysis tailored to your daily nutrition and goals.',
      };
      setMessages([welcome]);
      setSuggestedPrompts(
        isBn
          ? [
              'এই খাবারের গ্লাইসেমিক লোড কীভাবে কমাব?',
              'রান্নায় তেল শোষণ কমানোর বৈজ্ঞানিক পদ্ধতি কী?',
              'প্যান্ট্রির খাবার দিয়ে বাজেট ফ্রেন্ডলি প্রোটিন ডায়েট কী হতে পারে?',
            ]
          : [
              'How do I lower the glycemic load of this meal?',
              'How to reduce cooking oil absorption?',
              'What budget-friendly protein meals can I make from my pantry?',
            ]
      );
      setCitations(isBn ? ['BIRDEM ক্লিনিক্যাল গাইডলাইন', 'INFS খাদ্য ডাটাবেজ'] : ['BIRDEM Clinical Protocols', 'INFS Nutrition DB']);
    } else {
      const welcome: DisplayCoachMessage = {
        role: 'assistant',
        persona: 'coach',
        content: isBn
          ? '🧠 **হ্যালো! আমি ফারহান আহমেদ (আচরণ ও অভ্যাস কোচ)।**\n\n' +
            'সুস্থ জীবনযাপন কোনো চাপ বা কড়া ডায়েট নয়, বরং ভালো লাগার অভ্যাস। পারিবারিক দাওয়াত, মিষ্টির ক্রেভিং বা রুটিন ধরে রাখার সহজ মনস্তাত্ত্বিক পরামর্শ পেতে আমাকে জানাতে পারেন। কোনো অপরাধবোধ ছাড়াই আমরা এগিয়ে যাব! 💚'
          : '🧠 **Hello! I am Farhan Ahmed (Behavioral & Habit Coach).**\n\n' +
            'Healthy living isn\'t about rigid restrictions or guilt—it\'s about building compassionate, lasting habits. Let\'s navigate family feasts, sweet cravings, and daily routines together! 💚',
        voice_summary: isBn
          ? 'হ্যালো! আমি আপনার আচরণ ও অভ্যাস কোচ ফারহান আহমেদ। দাওয়াত ও খাদ্যাভ্যাসের মনস্তাত্ত্বিক নির্দেশনায় আমি সাথে আছি।'
          : 'Hello! I am Farhan Ahmed, your habit coach. Let us build sustainable, guilt-free nutrition habits together.',
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
  }, [agentType, isBn, stopAudio]);

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

  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRec) {
      alert(
        isBn
          ? 'আপনার ব্রাউজারে স্পিচ রিকগনিশন সুবিধা উপলব্ধ নেই। কিবোর্ড দিয়ে লিখুন।'
          : 'Speech recognition is not supported in this browser. Please type your message.'
      );
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.lang = speechLang;
      recognition.interimResults = true;
      recognition.continuous = false;

      recognition.onstart = () => {
        setIsListening(true);
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((r: any) => r[0].transcript)
          .join('');
        setInput(transcript);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const content = (textToSend ?? input).trim();
    if (!content && !imagePreview) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
    stopAudio();

    const userMsg: DisplayCoachMessage = {
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

      // Dual-channel voice request with database auto-enrichment
      const res = await sendCoachVoiceChat({
        message: content,
        history: historyToSend,
        messages: nextMessages,
        agent_type: agentType,
        persona: agentType,
        user_profile: profile,
        lang: language,
        include_audio: true,
      });

      const assistantMsg: DisplayCoachMessage = {
        role: 'assistant',
        persona: agentType,
        content: res.reply,
        voice_summary: res.voice_summary,
        audio_base64: res.audio_base64,
        audio_mime_type: res.audio_mime_type,
        use_browser_tts: res.use_browser_tts,
        tts_diagnostic: res.tts_diagnostic,
      };

      console.info('[AI Coach Voice Chat Response]', {
        diagnostic: res.tts_diagnostic,
        useBrowserTTS: res.use_browser_tts,
        hasAudio: Boolean(res.audio_base64),
      });

      const newIndex = nextMessages.length;
      setMessages((prev) => [...prev, assistantMsg]);

      if (res.suggested_prompts && res.suggested_prompts.length > 0) {
        setSuggestedPrompts(res.suggested_prompts);
      }
      if (res.citations && res.citations.length > 0) {
        setCitations(res.citations);
      }

      // Automatically speak the concise voice summary
      if (assistantMsg.audio_base64 || assistantMsg.voice_summary) {
        playAudioForMessage(newIndex, assistantMsg);
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
      {/* Root Layout Container with guaranteed 160px bottom dock clearance */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 160 }}>
        {/* Header Title & Persona Switcher */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2
                style={{
                  fontSize: 'var(--text-lg)',
                  fontWeight: 700,
                  color: isDark ? '#F9F2E4' : T.primary,
                  margin: 0,
                  letterSpacing: '-0.02em',
                }}
              >
                {isBn ? 'মাল্টি-এজেন্ট ভয়েস এআই কোচ' : 'Multi-Agent Voice AI Coach'}
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: isDark ? 'rgba(249, 242, 228, 0.78)' : T.inkSoft }}>
                {isBn
                  ? 'লাইভ ডাটাবেজ সমন্বিত পুষ্টি বিজ্ঞান ও সহানুভূতিশীল আচরণ ভয়েস অ্যাসিস্ট্যান্ট'
                  : 'Grounded biochemical science and empathetic voice coaching from live database'}
              </p>
            </div>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: agentType === 'scientist'
                  ? (isDark ? 'rgba(208, 174, 146, 0.20)' : 'rgba(74, 58, 52, 0.12)')
                  : (isDark ? 'rgba(134, 239, 172, 0.20)' : 'rgba(78, 124, 76, 0.15)'),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: agentType === 'scientist' ? (isDark ? '#E8C49A' : T.primary) : (isDark ? '#86EFAC' : '#2E6333'),
              }}
            >
              <Bot size={20} />
            </div>
          </div>

          {/* Database Grounding Badge */}
          <div
            style={{
              padding: '6px 12px',
              borderRadius: 10,
              background: isDark ? 'rgba(184, 198, 138, 0.15)' : 'rgba(122, 140, 79, 0.10)',
              border: isDark ? '1px solid rgba(184, 198, 138, 0.30)' : '1px solid rgba(122, 140, 79, 0.20)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 'var(--text-xs)',
              color: isDark ? '#B8C68A' : '#4E6828',
              fontWeight: 600,
            }}
          >
            <Sparkles size={13} style={{ flexShrink: 0 }} />
            <span>
              {isBn
                ? 'ডাটাবেজ সমন্বয় সক্রিয়: আপনার স্বাস্থ্য প্রোফাইল, আজকের খাবার ও প্যান্ট্রির তথ্যের সাথে সংযুক্ত'
                : 'Live DB Grounded: Tailored to your profile, today\'s logged meals & pantry inventory'}
            </span>
          </div>

          {/* Dual-Agent Selector Toggle */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
              background: isDark ? 'rgba(42, 32, 27, 0.92)' : 'rgba(255, 255, 255, 0.65)',
              padding: 4,
              borderRadius: 16,
              border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : `1px solid ${T.cardBorder}`,
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
                background: agentType === 'scientist' ? (isDark ? '#D0AE92' : T.primary) : 'transparent',
                color: agentType === 'scientist' ? (isDark ? '#1F1815' : '#FFFFFF') : (isDark ? '#F9F2E4' : T.ink),
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
                background: agentType !== 'scientist' ? (isDark ? '#4ADE80' : '#2E6333') : 'transparent',
                color: agentType !== 'scientist' ? (isDark ? '#143118' : '#FFFFFF') : (isDark ? '#F9F2E4' : T.ink),
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
              <span>{isBn ? 'ফারহান (আচরণ কোচ)' : 'Farhan (Habit Coach)'}</span>
            </motion.button>
          </div>
        </div>

        {/* Clinical Disclaimer Banner */}
        <div
          style={{
            padding: '8px 12px',
            borderRadius: 12,
            background: isDark ? 'rgba(240, 183, 154, 0.12)' : 'rgba(197, 85, 59, 0.08)',
            border: isDark ? '1px solid rgba(240, 183, 154, 0.28)' : '1px solid rgba(197, 85, 59, 0.20)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 'var(--text-xs)',
            color: isDark ? '#F0B79A' : '#A8432A',
            lineHeight: 1.4,
          }}
        >
          <ShieldAlert size={14} style={{ flexShrink: 0 }} />
          <span>
            {isBn
              ? '⚠️ এআই কোচের পরামর্শ তথ্যমূলক ও শিক্ষামূলক, কোনো চিকিৎসাগত প্রেসক্রিপশন বা বিকল্প নয়।'
              : '⚠️ AI Coach guidance is educational; consult a physician for clinical diagnoses.'}
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
            const isSpeakingThis = isPlayingAudio && currentPlayingIndex === idx;

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
                    color: isDark ? 'rgba(249, 242, 228, 0.78)' : T.inkSoft,
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
                      <span style={{ fontWeight: 600, color: isDark ? '#E8C49A' : T.primary }}>
                        🔬 {isBn ? 'ড. সুস্মিত (পুষ্টি বিজ্ঞানী)' : 'Dr. Susmit (Scientist)'}
                      </span>
                      <span style={{ opacity: 0.7 }}>• BIRDEM / ADA</span>
                    </>
                  ) : (
                    <>
                      <span style={{ fontWeight: 600, color: isDark ? '#86EFAC' : '#2E6333' }}>
                        🧠 {isBn ? 'ফারহান আহমেদ (আচরণ কোচ)' : 'Farhan Ahmed (Habit Coach)'}
                      </span>
                      <span style={{ opacity: 0.7 }}>• CBT & Habits</span>
                    </>
                  )}
                </div>

                {/* Message Bubble */}
                <div
                  className={isUser ? 'coach-bubble-user' : 'coach-bubble-assistant glass-card'}
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
                          backgroundColor: isDark ? 'rgba(42, 32, 27, 0.94)' : '#FFFFFF',
                          border: isDark
                            ? '1px solid rgba(255, 255, 255, 0.12)'
                            : '1px solid rgba(92, 64, 51, 0.12)',
                          boxShadow: isDark
                            ? '0 4px 20px rgba(0, 0, 0, 0.35)'
                            : '0 2px 8px rgba(0, 0, 0, 0.04)',
                          fontSize: '0.9375rem',
                          lineHeight: 1.65,
                          color: isDark ? '#F9F2E4' : '#2C221E',
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

                  {/* Spoken Voice Summary Card */}
                  {!isUser && m.voice_summary && (
                    <div
                      style={{
                        padding: '8px 12px',
                        borderRadius: 10,
                        background: isDark ? 'rgba(208, 174, 146, 0.12)' : 'rgba(201, 98, 45, 0.08)',
                        border: isDark ? '1px solid rgba(208, 174, 146, 0.25)' : '1px solid rgba(201, 98, 45, 0.18)',
                        marginBottom: 12,
                        fontSize: 'var(--text-xs)',
                        color: isDark ? '#E8C49A' : '#77574A',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                        <Volume2 size={14} style={{ flexShrink: 0, color: isDark ? '#E8C49A' : T.primary }} />
                        <span style={{ fontStyle: 'italic', lineHeight: 1.4 }}>
                          &ldquo;{m.voice_summary}&rdquo;
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => playAudioForMessage(idx, m)}
                        disabled={fetchingAudioId === idx}
                        aria-label={isSpeakingThis ? 'Stop voice' : 'Play voice'}
                        style={{
                          background: isSpeakingThis
                            ? (isDark ? 'rgba(240, 183, 154, 0.25)' : 'rgba(201, 98, 45, 0.15)')
                            : 'transparent',
                          border: 'none',
                          borderRadius: 6,
                          cursor: fetchingAudioId === idx ? 'wait' : 'pointer',
                          padding: '4px 6px',
                          color: isDark ? '#E8C49A' : T.primary,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontWeight: 600,
                          fontSize: 11,
                          opacity: fetchingAudioId === idx ? 0.7 : 1,
                        }}
                      >
                        {fetchingAudioId === idx ? (
                          <>
                            <Loader2 size={13} className="animate-spin" />
                            <span>{isBn ? 'প্রস্তুত হচ্ছে...' : 'Loading...'}</span>
                          </>
                        ) : isSpeakingThis ? (
                          <>
                            <VolumeX size={13} />
                            <span>{isBn ? 'থামুন' : 'Stop'}</span>
                          </>
                        ) : (
                          <>
                            <Volume2 size={13} />
                            <span>{isBn ? 'শুনুন' : 'Listen'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  <FormattedMessage content={m.content} isUser={isUser} isDark={isDark} />

                  {/* Fallback Listen action for assistant messages without voice_summary */}
                  {!isUser && !m.voice_summary && m.content && (
                    <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        onClick={() => playAudioForMessage(idx, m)}
                        disabled={fetchingAudioId === idx}
                        aria-label={isSpeakingThis ? 'Stop voice' : 'Play voice'}
                        style={{
                          background: isSpeakingThis
                            ? (isDark ? 'rgba(240, 183, 154, 0.25)' : 'rgba(201, 98, 45, 0.15)')
                            : 'transparent',
                          border: isDark ? '1px solid rgba(208, 174, 146, 0.2)' : '1px solid rgba(201, 98, 45, 0.2)',
                          borderRadius: 6,
                          cursor: fetchingAudioId === idx ? 'wait' : 'pointer',
                          padding: '3px 8px',
                          color: isDark ? '#E8C49A' : T.primary,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontWeight: 600,
                          fontSize: 11,
                          opacity: fetchingAudioId === idx ? 0.7 : 1,
                        }}
                      >
                        {fetchingAudioId === idx ? (
                          <>
                            <Loader2 size={12} className="animate-spin" />
                            <span>{isBn ? 'প্রস্তুত হচ্ছে...' : 'Loading...'}</span>
                          </>
                        ) : isSpeakingThis ? (
                          <>
                            <VolumeX size={12} />
                            <span>{isBn ? 'থামুন' : 'Stop'}</span>
                          </>
                        ) : (
                          <>
                            <Volume2 size={12} />
                            <span>{isBn ? 'শুনুন' : 'Listen'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
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
                background: isDark ? 'rgba(42, 32, 27, 0.90)' : 'rgba(255, 255, 255, 0.85)',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : `1px solid ${T.cardBorder}`,
                width: 'fit-content',
                fontSize: 'var(--text-xs)',
                color: isDark ? '#F9F2E4' : T.inkSoft,
              }}
            >
              <Sparkles size={14} className="animate-spin" color={isDark ? '#E8C49A' : T.primary} />
              <span>
                {agentType === 'scientist'
                  ? isBn
                    ? 'ডাটাবেজ তথ্য ও পুষ্টি বিজ্ঞান বিশ্লেষণ হচ্ছে…'
                    : 'Analyzing database targets & biochemical nutrition…'
                  : isBn
                    ? 'সহানুভূতিশীল আচরণ নির্দেশিকা সাজানো হচ্ছে…'
                    : 'Formulating habit guidance from your data…'}
              </span>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Domain Citation Badges */}
        {citations.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: isDark ? 'rgba(249, 242, 228, 0.78)' : T.inkSoft, fontWeight: 600 }}>
              {isBn ? 'স্বীকৃত তথ্যসূত্র:' : 'Official Citations:'}
            </span>
            {citations.map((c, i) => (
              <span
                key={i}
                style={{
                  fontSize: 'var(--text-xs)',
                  padding: '3px 8px',
                  borderRadius: 8,
                  background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(74, 58, 52, 0.08)',
                  color: isDark ? '#F9F2E4' : T.ink,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.10)' : 'none',
                }}
              >
                <CheckCircle size={11} color={isDark ? '#86EFAC' : '#2E6333'} />
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
                color: isDark ? 'rgba(249, 242, 228, 0.78)' : T.inkSoft,
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
                    background: isDark ? 'rgba(42, 32, 27, 0.92)' : 'rgba(255, 255, 255, 0.90)',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : `1px solid ${T.cardBorder}`,
                    color: isDark ? '#F9F2E4' : T.ink,
                    fontSize: 'var(--text-sm)',
                    lineHeight: 1.4,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.3)' : '0 1px 4px rgba(0,0,0,0.03)',
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
                background: isDark ? 'rgba(42, 32, 27, 0.92)' : 'rgba(255,255,255,0.9)',
                borderRadius: 12,
                border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : `1px solid ${T.cardBorder}`,
                width: 'fit-content',
              }}
            >
              <img
                src={imagePreview}
                alt="Upload preview"
                style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover' }}
              />
              <span style={{ fontSize: 'var(--text-xs)', color: isDark ? '#F9F2E4' : T.ink }}>
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
                  color: isDark ? 'rgba(249, 242, 228, 0.78)' : T.inkSoft,
                }}
              >
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input Bar with Attachment, Mic, and Send */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: isDark ? 'rgba(42, 32, 27, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            padding: '6px 12px',
            borderRadius: 24,
            border: isDark ? '1px solid rgba(255, 255, 255, 0.14)' : `1px solid ${T.cardBorder}`,
            boxShadow: isDark ? '0 4px 20px rgba(0, 0, 0, 0.4)' : '0 4px 16px rgba(46, 37, 34, 0.08)',
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
              color: isDark ? 'rgba(249, 242, 228, 0.78)' : T.inkSoft,
              padding: 6,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ImageIcon size={18} />
          </button>

          {/* Voice Mic Button */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.90 }}
            onClick={toggleListening}
            aria-label={isListening ? 'Stop listening' : 'Start voice input'}
            style={{
              background: isListening
                ? (isDark ? 'rgba(240, 183, 154, 0.3)' : 'rgba(201, 98, 45, 0.18)')
                : 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: isListening ? (isDark ? '#F0B79A' : '#C9622D') : (isDark ? 'rgba(249, 242, 228, 0.78)' : T.inkSoft),
              padding: 6,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isListening ? (
              <MicOff size={18} className="animate-pulse" />
            ) : (
              <Mic size={18} />
            )}
          </motion.button>

          {/* Quick Voice Language Toggle Pill (BN / EN) */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => {
              const next = speechLang === 'bn-BD' ? 'en-US' : 'bn-BD';
              setSpeechLang(next);
              if (isListening && recognitionRef.current) {
                recognitionRef.current.stop();
                setIsListening(false);
              }
            }}
            aria-label={`Switch voice language, currently ${speechLang === 'bn-BD' ? 'Bangla' : 'English'}`}
            title={speechLang === 'bn-BD' ? 'ভয়েস ভাষা: বাংলা (ইংরেজিতে পরিবর্তন করতে ট্যাপ করুন)' : 'Voice language: English (Tap to switch to Bangla)'}
            style={{
              padding: '2px 7px',
              borderRadius: 8,
              border: isDark
                ? '1px solid rgba(255, 255, 255, 0.16)'
                : '1px solid rgba(74, 58, 52, 0.18)',
              background: isDark
                ? (speechLang === 'bn-BD' ? 'rgba(208, 174, 146, 0.22)' : 'rgba(255, 255, 255, 0.08)')
                : (speechLang === 'bn-BD' ? 'rgba(74, 58, 52, 0.12)' : 'rgba(74, 58, 52, 0.06)'),
              color: isDark ? '#F9F2E4' : T.ink,
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              fontFamily: 'Inter, sans-serif',
              lineHeight: 1.3,
              userSelect: 'none',
              flexShrink: 0,
            }}
          >
            <span>{speechLang === 'bn-BD' ? 'বাং' : 'EN'}</span>
          </motion.button>

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
              isListening
                ? speechLang === 'bn-BD'
                  ? 'বাংলায় কথা বলুন… শুনছি…'
                  : 'Listening in English… speak now…'
                : agentType === 'scientist'
                ? isBn
                  ? 'ডায়েট বা খাবার নিয়ে জিজ্ঞাসা করুন…'
                  : 'Ask about diet, glycemic load, pantry…'
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
              color: isDark ? '#F9F2E4' : T.ink,
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
              background: !input.trim() && !imagePreview
                ? (isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(74, 58, 52, 0.25)')
                : (isDark ? '#D0AE92' : T.primary),
              border: 'none',
              borderRadius: '50%',
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isDark ? '#1F1815' : '#FFFFFF',
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
