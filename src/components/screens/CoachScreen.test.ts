import { describe, expect, it } from 'vitest';
import { sendCoachChat } from '../../lib/api';
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
});

