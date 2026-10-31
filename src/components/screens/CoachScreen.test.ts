import { describe, expect, it } from 'vitest';
import { sendCoachChat, sendCoachVoiceChat, generateCoachTTS } from '../../lib/api';
import type { CoachChatRequest } from '../../types/schemas';

describe('sendCoachChat', () => {
  it('returns biochemical scientist advice with BIRDEM citations for scientist persona', async () => {
    const req: CoachChatRequest = {
      messages: [
        { role: 'user', content: 'এই খাবারের গ্লাইসেমিক লোড কীভাবে কমাব?' },
      ],
      agent_type: 'scientist',
    };
    const res = await sendCoachChat(req);
    expect(res.agent_type).toBe('scientist');
    expect(res.reply).toContain('বায়োকেমিক্যাল পুষ্টি বিশ্লেষণ');
    expect(res.citations.length).toBeGreaterThan(0);
    expect(res.suggested_prompts.length).toBeGreaterThan(0);
  });

  it('returns empathetic habit coaching for behavioral persona', async () => {
    const req: CoachChatRequest = {
      messages: [
        { role: 'user', content: 'দাওয়াতে অতিরিক্ত খাওয়ার পর কী করব?' },
      ],
      agent_type: 'behavioral',
    };
    const res = await sendCoachChat(req);
    expect(res.agent_type).toBe('behavioral');
    expect(res.reply).toContain('আচরণ ও অভ্যাস কোচ');
    expect(res.suggested_prompts.some((p) => p.includes('দাওয়াতে') || p.includes('মিষ্টি'))).toBe(true);
  });

  it('handles greeting "হ্যালো" concisely without dumping lectures for scientist', async () => {
    const req: CoachChatRequest = {
      message: 'হ্যালো',
      history: [],
      agent_type: 'scientist',
    };
    const res = await sendCoachChat(req);
    expect(res.agent_type).toBe('scientist');
    expect(res.reply.length).toBeLessThan(120);
    expect(res.reply).toContain('হ্যালো');
  });

  it('handles English greeting "hi" with lang: "en" returning pure English reply and prompts', async () => {
    const req: CoachChatRequest = {
      message: 'hi',
      history: [],
      agent_type: 'scientist',
      lang: 'en',
    };
    const res = await sendCoachChat(req);
    expect(res.agent_type).toBe('scientist');
    expect(res.reply.toLowerCase()).toContain('hello');
    expect(res.reply).not.toContain('হ্যালো');
    expect(res.suggested_prompts.some((p) => /[\u0980-\u09FF]/.test(p))).toBe(false);
  });

  it('sendCoachVoiceChat provides dual-channel voice summary and speech fallback', async () => {
    const req: CoachChatRequest = {
      message: 'বাজেট ফ্রেন্ডলি ডায়েট কী?',
      agent_type: 'scientist',
      include_audio: true,
    };
    const res = await sendCoachVoiceChat(req);
    expect(res.reply).toBeDefined();
    expect(res.voice_summary).toBeDefined();
    expect(typeof res.voice_summary).toBe('string');
    expect(res.use_browser_tts).toBe(true);
  });

  it('generateCoachTTS gracefully degrades with fallback flags', async () => {
    const res = await generateCoachTTS({ text: 'Hello, this is NutriVision AI Coach' });
    expect(res.audio_mime_type).toBe('audio/mpeg');
    expect(res.use_browser_tts).toBe(true);
  });
});

