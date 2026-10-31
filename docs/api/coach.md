# AI Coach & Voice Assistant API (`/api/coach/*`)

Comprehensive documentation for NutriVision AI's Multi-Agent Conversational AI Coach and Voice Assistant system.

---

## 1. Architectural Blueprint & Data Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│ Browser Client (PWA) — CoachScreen.tsx                                 │
│ • Web Speech API STT (Live mic with on-the-fly [বাং / EN] toggle)       │
│ • Formatted Markdown & KaTeX rendering (Clinical cards / Habit loops)  │
│ • HTML5 Audio playback for ElevenLabs & edge-tts MP3 streams           │
│ • On-demand "🔊 Listen" button with client-side message audio cache     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                         POST /api/coach/voice-chat
                         POST /api/coach/tts
                                    │ (Proxied via Vercel edge rewrite)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ FastAPI Backend — app/api/coach.py & app/services/coach_service.py      │
│                                                                        │
│  1. Live PostgreSQL Multi-Tenant Grounding:                            │
│     • nv_users: Age, sex, height, weight, conditions, calorie targets  │
│     • nv_meals: Today's logged meals, actual intake, remaining budget  │
│     • nv_grocery: Active pantry inventory for home recipe advice       │
│                                                                        │
│  2. ChromaDB RAG Vector Store:                                         │
│     • Evidence-based BIRDEM / ADA clinical nutrition guidelines        │
│     • WHO lifestyle & CBT behavioral habit loop protocols              │
│                                                                        │
│  3. Single-Pass Dual-Channel Inference:                                │
│     • Generates detailed clinical Markdown UI card                     │
│     • Generates concise spoken summary (<60 words, clean of Markdown)  │
│       delimited by "===VOICE_SUMMARY===" in ONE model pass             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Spoken voice_summary
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Tiered Speech Synthesis Engine — app/services/tts_service.py           │
│                                                                        │
│  [Tier 1: ElevenLabs Premade Voices (~75ms TTFA)]                      │
│  • Dr. Susmit (Scientist):  JBFqnCBsd6RMkjVDRZzb (George - Premade Male│
│  • Farhan (Habit Coach):   JBFqnCBsd6RMkjVDRZzb (George - Premade Male│
│  • English: eleven_flash_v2_5 | Bengali: eleven_multilingual_v2        │
│  • Strictly ignores legacy library voice IDs (e.g. 21m00Tcm4TlvDq8ikWAM│
│  • Auto-retry on HTTP 400/402 with default premade voice               │
│                                   │                                    │
│                     (If Tier 1 fails or unconfigured)                  │
│                                   ▼                                    │
│  [Tier 2: Server-Side Neural TTS (edge-tts / Zero API Key)]            │
│  • Dr. Susmit (Scientist):                                             │
│      - Bengali: bn-BD-PradeepNeural                                    │
│      - English: en-US-AndrewNeural                                     │
│  • Farhan (Habit Coach):                                               │
│      - Bengali: bn-BD-PradeepNeural                                    │
│      - English: en-US-BrianNeural                                      │
│  • Thread-isolated async event loop execution (non-blocking)           │
│                                   │                                    │
│                     (If Tier 2 fails or offline)                       │
│                                   ▼                                    │
│  [Tier 3: Client Browser Fallback]                                     │
│  • window.speechSynthesis (Web Speech API) with Bengali/English pitch  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Multi-Agent Personas

NutriVision AI features two specialized AI coaches, selectable by the user:

| Persona | Role | Core Expertise | Voice (ElevenLabs) | Voice (edge-tts) |
|---|---|---|---|---|
| **🔬 Dr. Susmit** | Nutritional Biochemist | Glycemic load ($GL$), cooking oil absorption rates, clinical macronutrient partitioning per BIRDEM/ADA protocols | `JBFqnCBsd6RMkjVDRZzb` (George, Premade Male) | `en-US-AndrewNeural` / `bn-BD-PradeepNeural` |
| **🧠 Farhan Ahmed** | Behavioral & Habit Coach | CBT-based habit science, evening cravings, guilt-free family feast (*dawat*) recovery, small sustainable routines | `JBFqnCBsd6RMkjVDRZzb` (George, Premade Male) | `en-US-BrianNeural` / `bn-BD-PradeepNeural` |

---

## 3. Endpoints Reference

### A. Dual-Channel Voice Chat (`POST /api/coach/voice-chat`)

Sends a conversational query to the AI Coach with live database grounding and audio generation.

#### Request Body (`CoachChatRequest`)
```json
{
  "message": "আজ রাতের খাবারে কী খেতে পারি?",
  "agent_type": "scientist",
  "persona": "scientist",
  "lang": "bn",
  "include_audio": true,
  "history": [
    { "role": "user", "content": "hello" },
    { "role": "assistant", "content": "স্বাগতম! আমি ড. সুস্মিত..." }
  ]
}
```

#### Response Body (`CoachChatResponse`)
```json
{
  "reply": "🔬 **ড. সুস্মিতের বিশ্লেষণ:**\n\nআজকের বাকি থাকা ক্যালোরি ও কার্বোহাইড্রেট বাজেটের মধ্যে...",
  "voice_summary": "আজ রাতের খাবারে পালং শাক ভাজি এবং একটি সেদ্ধ ডিম খেতে পারেন। এতে গ্লাইসেমিক লোড নিয়ন্ত্রণে থাকবে।",
  "citations": ["BIRDEM ক্লিনিক্যাল গাইডলাইন", "INFS পুষ্টি ডাটাবেজ"],
  "suggested_prompts": [
    "এই খাবারের গ্লাইসেমিক লোড কীভাবে কমাব?",
    "বাজেট ফ্রেন্ডলি প্রোটিন উৎস কী কী?"
  ],
  "agent_type": "scientist",
  "audio_base64": "SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU5LjI3LjEw...",
  "audio_mime_type": "audio/mpeg",
  "use_browser_tts": false,
  "tts_diagnostic": "ok"
}
```

---

### B. Standard Chat (`POST /api/coach/chat`)

Lightweight text-only chat without audio synthesis.

#### Request Body (`CoachChatRequest`)
```json
{
  "messages": [
    { "role": "user", "content": "How do I bounce back after a heavy dinner?" }
  ],
  "agent_type": "behavioral",
  "persona": "behavioral",
  "lang": "en"
}
```

---

### C. On-Demand Speech Synthesis (`POST /api/coach/tts`)

Synthesizes speech on-demand for any text bubble, welcome message, or historical message.

#### Request Body (`CoachTTSRequest`)
```json
{
  "text": "Hello! I am Farhana Ahmed. Let's build healthy habits together.",
  "lang": "en",
  "persona": "behavioral"
}
```

#### Response Body (`CoachTTSResponse`)
```json
{
  "audio_base64": "SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU5LjI3LjEw...",
  "audio_mime_type": "audio/mpeg",
  "use_browser_tts": false,
  "tts_diagnostic": "ok"
}
```

---

## 4. Multi-Tier Speech Synthesis Architecture

`app/services/tts_service.py` implements a resilient 3-tier speech synthesis cascade:

```
[Incoming Text & Persona]
           │
           ▼
[Check ElevenLabs Config & Model]
   • Is ELEVENLABS_API_KEY set?
   • Resolve Persona Voice ID (Premade George default)
   • Auto-select model (eleven_flash_v2_5 vs eleven_multilingual_v2)
   • Check in-memory LRU cache (128 slots)
           │
     ┌─────┴─────────────────────────────────┐
     │ ElevenLabs Available & Configured     │ Unconfigured / Key Missing
     ▼                                       │
[ElevenLabs REST Request]                    │
     │                                       │
     ├─► HTTP 200 OK: Return MP3 Audio       │
     │                                       │
     └─► HTTP 400/402 (Library voice error): │
         Auto-retry with Premade Voice ID ───┤
         (George JBFqnCBsd6RMkjVDRZzb)       │
         If retry fails / 429 quota:         │
                                             │
                                             ▼
                          [Tier 2: edge-tts Neural Synthesis]
                          • Dr. Susmit: Andrew (EN) / Pradeep (BN)
                          • Farhan: Brian (EN) / Pradeep (BN)
                          • Microsoft Azure Neural Network (zero-key)
                                             │
                                             ├─► Success: Return MP3 Audio
                                             │   tts_diagnostic: "ok (edge_neural_fallback: ...)"
                                             │   use_browser_tts: false
                                             │
                                             └─► Offline / Socket Error:
                                                 ▼
                                  [Tier 3: Client Browser TTS]
                                  • window.speechSynthesis
                                  • use_browser_tts: true
                                  • audio_base64: null
```

### In-Memory LRU Cache Isolation

To prevent voice bleed and cache collisions when switching between coaches (e.g. Dr. Susmit vs Farhan speaking similar or identical greeting text), the in-memory LRU cache indexes entries with full persona and voice namespace isolation:

```python
cache_key = f"{persona}:{voice_id}:{model_id}:{hashlib.md5(clean_text.encode()).hexdigest()}"
```

- **Dr. Susmit (Scientist):** `scientist:JBFqnCBsd6RMkjVDRZzb:eleven_flash_v2_5:<hash>`
- **Farhan (Behavioral / Habit Coach):** `behavioral:JBFqnCBsd6RMkjVDRZzb:eleven_flash_v2_5:<hash>`
- Identical greetings spoken by different personas never collide or overwrite each other.

---

## 5. Diagnostics & Observability

Every audio response includes `tts_diagnostic` to provide transparent visibility in the browser Network tab and logs:

| `tts_diagnostic` Value | Meaning |
|---|---|
| `"ok"` | Fresh synthesis from ElevenLabs succeeded. |
| `"ok (cache_hit)"` | Served from in-memory 128-slot LRU cache with zero network latency. |
| `"ok (premade_voice_retry)"` | A configured legacy/custom voice was rejected (HTTP 402/400) and auto-retry with premade voice succeeded. |
| `"ok (edge_neural_fallback: <reason>)"` | ElevenLabs was unavailable/quota-depleted; server-side `edge-tts` synthesized high-quality neural MP3 audio. |
| `"edge_failed: <reason>"` | Both ElevenLabs and `edge-tts` failed (e.g. offline container); client will speak via browser Web Speech API. |
| `"empty_text"` | The input text contained no spoken words after sanitization. |

---

## 6. Frontend Voice & Audio Player Flow

1. **Microphone (STT):**
   - Click the mic button in `CoachScreen.tsx`.
   - Browser initiates Web Speech API recognition.
   - The user can toggle `[বাং / EN]` immediately adjacent to the microphone to switch between Bengali (`bn-BD`) and English (`en-US`) speech recognition models.
2. **"🔊 Listen" Button Flow:**
   - Every assistant message bubble displays a spoken summary card and a `🔊 Listen` / `শুনুন` button.
   - If audio is already pre-generated: plays instantly via HTML5 `Audio`.
   - If audio is not yet loaded (e.g. initial welcome message or text-only reply):
     - Displays `<Loader2 className="animate-spin" />` with text `প্রস্তুত হচ্ছে...` / `Loading...`.
     - Calls `POST /api/coach/tts` passing `text`, `lang`, and `persona`.
     - Caches the received base64 MP3 onto the message object in React state so subsequent clicks never trigger network requests.
     - Plays the audio through HTML5 `Audio`.
     - Only falls back to `window.speechSynthesis` if audio generation fails.
