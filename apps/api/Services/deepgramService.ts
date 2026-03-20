/**
 * Deepgram STT Service (raw WebSocket)
 *
 * Manages per-user live Deepgram WebSocket connections for real-time
 * speech-to-text during calls. Audio chunks arrive from the client
 * via Socket.io and are forwarded to Deepgram's streaming API.
 *
 * Uses raw WebSocket instead of the SDK for reliability.
 */

import WebSocket from "ws";

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || "";

interface ActiveSession {
  ws: WebSocket;
  lang: string;
  keepAliveTimer: ReturnType<typeof setInterval> | null;
  /** Buffer audio chunks that arrive before the WS is open */
  pendingChunks: Buffer[];
  /** Track if we've successfully opened */
  opened: boolean;
}

// userId → active Deepgram session
const sessions = new Map<number, ActiveSession>();

/**
 * Start a Deepgram live transcription session for a user.
 */
export function startSession(
  userId: number,
  lang: string,
  onTranscript: (text: string, isFinal: boolean) => void
): void {
  stopSession(userId);

  if (!DEEPGRAM_API_KEY) {
    console.error("[DEEPGRAM] No DEEPGRAM_API_KEY set — cannot start STT session");
    return;
  }

  const dgLang = mapToDeepgramLang(lang);

  const params = new URLSearchParams({
    model: "nova-2",
    language: dgLang,
    encoding: "linear16",
    sample_rate: "16000",
    channels: "1",
    interim_results: "true",
    smart_format: "true",
    utterance_end_ms: "1500",
    vad_events: "true",
  });

  const url = `wss://api.deepgram.com/v1/listen?${params.toString()}`;

  console.log(`[DEEPGRAM] Connecting for user ${userId} (lang: ${dgLang})...`);

  const ws = new WebSocket(url, {
    headers: { Authorization: `Token ${DEEPGRAM_API_KEY}` },
  });

  const session: ActiveSession = {
    ws,
    lang: dgLang,
    keepAliveTimer: null,
    pendingChunks: [],
    opened: false,
  };

  ws.on("open", () => {
    console.log(`[DEEPGRAM] Session opened for user ${userId} (lang: ${dgLang})`);
    session.opened = true;

    // Flush any buffered audio chunks
    if (session.pendingChunks.length > 0) {
      console.log(`[DEEPGRAM] Flushing ${session.pendingChunks.length} buffered chunks`);
      for (const chunk of session.pendingChunks) {
        try { ws.send(chunk); } catch { break; }
      }
      session.pendingChunks = [];
    }

    // Keep-alive: send JSON keep-alive every 8s to prevent idle close
    session.keepAliveTimer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "KeepAlive" }));
      }
    }, 8000);
  });

  ws.on("message", (data: WebSocket.Data) => {
    try {
      const msg = JSON.parse(data.toString());

      // Transcript result
      if (msg.channel) {
        const alt = msg.channel.alternatives?.[0];
        if (!alt) return;
        const text = (alt.transcript || "").trim();
        if (!text) return;
        const isFinal = msg.is_final === true;
        console.log(`[DEEPGRAM] user=${userId} transcript: "${text}" (final: ${isFinal})`);
        onTranscript(text, isFinal);
      }
    } catch {
      // Ignore non-JSON messages
    }
  });

  ws.on("error", (err) => {
    console.error(`[DEEPGRAM] WebSocket error for user ${userId}:`, err.message);
  });

  ws.on("close", (code, reason) => {
    console.log(`[DEEPGRAM] Session closed for user ${userId} (code: ${code})`);
    const s = sessions.get(userId);
    if (s && s.ws === ws) {
      if (s.keepAliveTimer) clearInterval(s.keepAliveTimer);
      sessions.delete(userId);
    }
  });

  sessions.set(userId, session);
}

/**
 * Send an audio chunk to the user's active Deepgram session.
 * Expects raw PCM16 LE (16kHz, mono) as a Buffer.
 * If the WebSocket isn't open yet, buffers the chunk (up to ~5s of audio).
 */
export function sendAudio(userId: number, audioData: Buffer): void {
  const session = sessions.get(userId);
  if (!session) return;

  if (session.ws.readyState === WebSocket.OPEN) {
    try {
      session.ws.send(audioData);
    } catch {
      // Connection may have closed between check and send
    }
  } else if (session.ws.readyState === WebSocket.CONNECTING) {
    // Buffer chunks while connecting (limit to ~5 seconds = ~160KB at 16kHz mono 16bit)
    const MAX_PENDING_BYTES = 160000;
    const totalPending = session.pendingChunks.reduce((sum, c) => sum + c.length, 0);
    if (totalPending < MAX_PENDING_BYTES) {
      session.pendingChunks.push(audioData);
    }
  }
  // If CLOSING or CLOSED, silently drop
}

/**
 * Stop and clean up a user's Deepgram session.
 */
export function stopSession(userId: number): void {
  const session = sessions.get(userId);
  if (!session) return;

  if (session.keepAliveTimer) {
    clearInterval(session.keepAliveTimer);
  }

  if (session.ws.readyState === WebSocket.OPEN || session.ws.readyState === WebSocket.CONNECTING) {
    try {
      session.ws.close();
    } catch {
      // Already closed
    }
  }

  sessions.delete(userId);
  console.log(`[DEEPGRAM] Session stopped for user ${userId}`);
}

/**
 * Check if a user has an active session.
 */
export function hasSession(userId: number): boolean {
  return sessions.has(userId);
}

// ─── Language mapping ────────────────────────────────────────────────────────

const BCP47_TO_DEEPGRAM: Record<string, string> = {
  "ru-RU": "ru",
  "en-US": "en-US",
  "en-GB": "en-GB",
  "de-DE": "de",
  "fr-FR": "fr",
  "es-ES": "es",
  "zh-CN": "zh",
  "ja-JP": "ja",
  "it-IT": "it",
  "pt-BR": "pt-BR",
  "ko-KR": "ko",
  "tr-TR": "tr",
  "uk-UA": "uk",
  "nl-NL": "nl",
  "pl-PL": "pl",
};

function mapToDeepgramLang(bcp47: string): string {
  return BCP47_TO_DEEPGRAM[bcp47] ?? bcp47.split("-")[0];
}
