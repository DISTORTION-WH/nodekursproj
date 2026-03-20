/**
 * Deepgram STT Service (SDK v5)
 *
 * Manages per-user live Deepgram WebSocket connections for real-time
 * speech-to-text during calls. Audio chunks arrive from the client
 * via Socket.io and are forwarded to Deepgram's streaming API.
 */

import { DeepgramClient } from "@deepgram/sdk";

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || "";

interface ActiveSession {
  connection: any;
  lang: string;
  keepAliveTimer: ReturnType<typeof setInterval> | null;
  ready: boolean;
}

// userId → active Deepgram session
const sessions = new Map<number, ActiveSession>();

/**
 * Start a Deepgram live transcription session for a user.
 */
export async function startSession(
  userId: number,
  lang: string,
  onTranscript: (text: string, isFinal: boolean) => void
): Promise<void> {
  stopSession(userId);

  if (!DEEPGRAM_API_KEY) {
    console.error("[DEEPGRAM] No DEEPGRAM_API_KEY set — cannot start STT session");
    return;
  }

  const dgLang = mapToDeepgramLang(lang);

  try {
    const deepgram = new DeepgramClient({ apiKey: DEEPGRAM_API_KEY } as any);

    const connection: any = await (deepgram.listen.v1 as any).connect({
      model: "nova-2",
      language: dgLang,
      smart_format: true,
      interim_results: true,
      utterance_end_ms: 1500,
      vad_events: true,
      encoding: "linear16",
      sample_rate: 16000,
      channels: 1,
    });

    const session: ActiveSession = {
      connection,
      lang: dgLang,
      keepAliveTimer: null,
      ready: true,
    };

    connection.on("open", () => {
      console.log(`[DEEPGRAM] Session opened for user ${userId} (lang: ${dgLang})`);
      session.ready = true;
    });

    connection.on("transcript", (data: any) => {
      const alt = data.channel?.alternatives?.[0];
      if (!alt) return;
      const text = (alt.transcript || "").trim();
      if (!text) return;
      const isFinal = data.is_final === true;
      onTranscript(text, isFinal);
    });

    connection.on("error", (err: any) => {
      console.error(`[DEEPGRAM] Error for user ${userId}:`, err);
    });

    connection.on("close", () => {
      console.log(`[DEEPGRAM] Session closed for user ${userId}`);
      const s = sessions.get(userId);
      if (s && s.connection === connection) {
        if (s.keepAliveTimer) clearInterval(s.keepAliveTimer);
        sessions.delete(userId);
      }
    });

    // Keep-alive: prevent idle timeout (~10s of silence)
    session.keepAliveTimer = setInterval(() => {
      try {
        connection.keepAlive();
      } catch {
        // Connection may have closed
      }
    }, 8000);

    sessions.set(userId, session);
  } catch (err) {
    console.error(`[DEEPGRAM] Failed to start session for user ${userId}:`, err);
  }
}

/**
 * Send an audio chunk to the user's active Deepgram session.
 * Expects raw PCM16 LE (16kHz, mono) as a Buffer.
 */
export function sendAudio(userId: number, audioData: Buffer): void {
  const session = sessions.get(userId);
  if (!session || !session.ready) return;
  try {
    session.connection.send(audioData);
  } catch {
    // Connection may have closed
  }
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

  try {
    session.connection.requestClose();
  } catch {
    try {
      session.connection.close();
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
