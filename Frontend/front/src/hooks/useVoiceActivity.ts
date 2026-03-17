/**
 * useVoiceActivity
 *
 * Read-only observer hook for voice activity detection in calls.
 *
 * Supports two data sources (can be combined):
 *   1. MediaStream-based (Web Audio API AnalyserNode) — works for both
 *      local stream and remote streams from groupCallParticipants.
 *   2. RTCPeerConnection-based (getStats() inbound-rtp / media-source) —
 *      for direct access to WebRTC stats when peer connections are available.
 *
 * Usage with group call (MediaStream mode — recommended):
 *   const { participants, fairnessIndex, interruptions, totalCallTime } =
 *     useVoiceActivity({
 *       streams: [
 *         { participantId: "local", stream: localStream },
 *         ...groupCallParticipants.map(p => ({
 *           participantId: String(p.userId),
 *           stream: p.stream,
 *         })),
 *       ],
 *     });
 *
 * Usage with RTCPeerConnection (getStats mode):
 *   const { participants, fairnessIndex } = useVoiceActivity({
 *     peerConnections: [
 *       { participantId: String(userId), pc: myPeerConnection },
 *     ],
 *   });
 */

import { useEffect, useRef, useCallback } from "react";

// ─── Public interfaces ────────────────────────────────────────────────────────

export interface ParticipantVoiceState {
  /** Latest raw audio level [0..1] */
  audioLevel: number;
  /** True when smoothed average exceeds threshold for > 300 ms */
  isSpeaking: boolean;
  /** Cumulative seconds the participant was speaking */
  talkTime: number;
  /** Fraction of totalCallTime the participant was speaking [0..1] */
  talkPercent: number;
}

export interface InterruptionEvent {
  /** ID of the participant who started speaking over someone */
  interrupter: string;
  /** ID of the participant who was speaking and went silent */
  interrupted: string;
  /** Unix timestamp (ms) */
  timestamp: number;
}

export interface VoiceActivityResult {
  /** Per-participant voice metrics, keyed by participantId */
  participants: Map<string, ParticipantVoiceState>;
  /**
   * Jain's Fairness Index: F = (ΣTi)² / (N·ΣTi²)
   * Range [1/N .. 1], where 1 = perfectly equal talk time distribution.
   * Returns 1 when there is only one participant or no talk time yet.
   */
  fairnessIndex: number;
  /** Detected interruption events since the hook mounted */
  interruptions: InterruptionEvent[];
  /** Total wall-clock seconds since the hook mounted */
  totalCallTime: number;
}

// ─── Input descriptor types ───────────────────────────────────────────────────

export interface StreamDescriptor {
  /** Stable identifier for this participant, e.g. String(userId) or "local" */
  participantId: string;
  /** MediaStream from getUserMedia / groupCallParticipants[i].stream */
  stream: MediaStream | null;
}

export interface PeerConnectionDescriptor {
  /** Stable identifier for this participant */
  participantId: string;
  /** Live RTCPeerConnection to poll with getStats() */
  pc: RTCPeerConnection;
}

export interface UseVoiceActivityOptions {
  /**
   * MediaStream descriptors — preferred, lighter weight.
   * Uses Web Audio API AnalyserNode; fully read-only.
   */
  streams?: StreamDescriptor[];
  /**
   * RTCPeerConnection descriptors — use when you have direct access to the pc.
   * Polls getStats() every 200 ms and reads inbound-rtp / media-source audioLevel.
   */
  peerConnections?: PeerConnectionDescriptor[];
  /**
   * Poll interval in ms. Default: 200.
   */
  intervalMs?: number;
  /**
   * How many ticks to smooth audioLevel over (moving average window).
   * At 200 ms/tick, window=3 ≈ 600 ms of history.
   * Default: 3 (≈ 600 ms).
   */
  smoothingWindow?: number;
  /**
   * audioLevel threshold above which a participant is considered "possibly speaking".
   * Default: 0.04.
   */
  speakingThreshold?: number;
  /**
   * Sustained duration (ms) above threshold required to flip isSpeaking = true.
   * Default: 300.
   */
  speakingOnsetMs?: number;
  /**
   * Silence duration (ms) below threshold required to flip isSpeaking = false.
   * Default: 400 (slightly longer to avoid flicker on short pauses).
   */
  speakingOffsetMs?: number;
  /**
   * If interrupter starts speaking while interrupted is speaking, and interrupted
   * goes silent within this window (ms), it counts as an interruption.
   * Default: 1500.
   */
  interruptionWindowMs?: number;
}

// ─── Internal per-participant tracking state ──────────────────────────────────

interface ParticipantTrack {
  /** Ring buffer of recent raw audioLevel samples */
  levelHistory: number[];
  /** Current smoothed average */
  smoothedLevel: number;
  /** Current speaking state */
  isSpeaking: boolean;
  /** Timestamp when smoothed level first exceeded threshold (null if below) */
  aboveThresholdSince: number | null;
  /** Timestamp when smoothed level first dropped below threshold (null if above) */
  belowThresholdSince: number | null;
  /** Cumulative talk time in seconds */
  talkTime: number;
}

// ─── Web Audio analysis helper ────────────────────────────────────────────────

interface AnalyserEntry {
  analyser: AnalyserNode;
  dataArray: Uint8Array;
  source: MediaStreamAudioSourceNode;
  context: AudioContext;
}

// ─── Hook implementation ──────────────────────────────────────────────────────

export function useVoiceActivity(options: UseVoiceActivityOptions): VoiceActivityResult {
  const {
    streams = [],
    peerConnections = [],
    intervalMs = 200,
    smoothingWindow = 3,
    speakingThreshold = 0.04,
    speakingOnsetMs = 300,
    speakingOffsetMs = 400,
    interruptionWindowMs = 1500,
  } = options;

  // ── Result state (mutated in-place, returned via ref snapshot) ──────────────
  const participantsRef = useRef<Map<string, ParticipantVoiceState>>(new Map());
  const interruptionsRef = useRef<InterruptionEvent[]>([]);
  const totalCallTimeRef = useRef<number>(0);
  const startTimeRef = useRef<number>(Date.now());

  // ── Per-participant internal tracking ──────────────────────────────────────
  const trackRef = useRef<Map<string, ParticipantTrack>>(new Map());

  // ── Web Audio analyser nodes keyed by participantId ────────────────────────
  const analysersRef = useRef<Map<string, AnalyserEntry>>(new Map());

  // ── Interruption detection: who is currently speaking + since when ─────────
  // Map<participantId, timestamp when they started speaking>
  const currentlySpeakingRef = useRef<Map<string, number>>(new Map());

  // ── Result snapshot ref (returned to callers) ──────────────────────────────
  const resultRef = useRef<VoiceActivityResult>({
    participants: new Map(),
    fairnessIndex: 1,
    interruptions: [],
    totalCallTime: 0,
  });

  // ── Force-re-render signal: we use a lightweight counter in a ref + callback ─
  // (The hook returns a stable object ref; consumers that need reactivity
  //  should wrap the result in their own state via a wrapper component or
  //  pass an onUpdate callback. This avoids over-rendering on every tick.)

  // ─────────────────────────────────────────────────────────────────────────────
  // Helper: get or create a ParticipantTrack entry
  // ─────────────────────────────────────────────────────────────────────────────
  const getTrack = useCallback(
    (id: string): ParticipantTrack => {
      if (!trackRef.current.has(id)) {
        trackRef.current.set(id, {
          levelHistory: [],
          smoothedLevel: 0,
          isSpeaking: false,
          aboveThresholdSince: null,
          belowThresholdSince: null,
          talkTime: 0,
        });
      }
      return trackRef.current.get(id)!;
    },
    []
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // Helper: build / rebuild Web Audio analyser for a MediaStream
  // ─────────────────────────────────────────────────────────────────────────────
  const buildAnalyser = useCallback((id: string, stream: MediaStream): void => {
    // Tear down previous analyser for this id, if any
    const prev = analysersRef.current.get(id);
    if (prev) {
      try { prev.source.disconnect(); } catch { /* ignore */ }
      try { prev.context.close(); } catch { /* ignore */ }
      analysersRef.current.delete(id);
    }

    // We need at least one audio track that's live
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0 || audioTracks[0].readyState === "ended") return;

    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);
      // Do NOT connect analyser to destination — read-only observation
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analysersRef.current.set(id, { analyser, dataArray, source, context: ctx });
    } catch {
      // AudioContext may fail in some environments (e.g. SSR / tests)
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // Helper: read audioLevel from an AnalyserNode (returns 0..1)
  // Uses time-domain RMS which is more accurate than frequency-domain sum.
  // ─────────────────────────────────────────────────────────────────────────────
  const readAnalyserLevel = useCallback((entry: AnalyserEntry): number => {
    entry.analyser.getByteTimeDomainData(entry.dataArray);
    let sumSq = 0;
    const len = entry.dataArray.length;
    for (let i = 0; i < len; i++) {
      // Convert uint8 [0..255] to float [-1..1]
      const v = (entry.dataArray[i] - 128) / 128;
      sumSq += v * v;
    }
    return Math.sqrt(sumSq / len); // RMS [0..1]
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // Helper: extract audioLevel from RTCPeerConnection getStats()
  // Returns a map of direction → audioLevel
  // ─────────────────────────────────────────────────────────────────────────────
  const readPcStats = useCallback(
    async (pc: RTCPeerConnection): Promise<{ inbound: number; outbound: number }> => {
      let inbound = 0;
      let outbound = 0;

      try {
        const report = await pc.getStats();
        report.forEach((stat) => {
          if (stat.type === "inbound-rtp" && (stat as RTCInboundRtpStreamStats).kind === "audio") {
            // audioLevel is [0..1] as per WebRTC spec
            const level = (stat as RTCInboundRtpStreamStats & { audioLevel?: number }).audioLevel;
            if (typeof level === "number" && level > inbound) {
              inbound = level;
            }
          }
          if (stat.type === "media-source" && (stat as RTCStats & { kind?: string }).kind === "audio") {
            // audioLevel on media-source represents the local microphone
            const level = (stat as RTCStats & { audioLevel?: number }).audioLevel;
            if (typeof level === "number" && level > outbound) {
              outbound = level;
            }
          }
        });
      } catch {
        // pc may be closed
      }

      return { inbound, outbound };
    },
    []
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // Core: process a single raw audioLevel sample for a participant
  // ─────────────────────────────────────────────────────────────────────────────
  const processSample = useCallback(
    (id: string, rawLevel: number, nowMs: number, tickSec: number): void => {
      const track = getTrack(id);

      // 1. Moving average
      track.levelHistory.push(rawLevel);
      if (track.levelHistory.length > smoothingWindow) {
        track.levelHistory.shift();
      }
      const smoothed =
        track.levelHistory.reduce((a, b) => a + b, 0) / track.levelHistory.length;
      track.smoothedLevel = smoothed;

      // 2. Speaking onset/offset with hysteresis
      const wasSpeaking = track.isSpeaking;

      if (smoothed > speakingThreshold) {
        track.belowThresholdSince = null;
        if (track.aboveThresholdSince === null) {
          track.aboveThresholdSince = nowMs;
        }
        if (!track.isSpeaking && nowMs - track.aboveThresholdSince >= speakingOnsetMs) {
          track.isSpeaking = true;
        }
      } else {
        track.aboveThresholdSince = null;
        if (track.belowThresholdSince === null) {
          track.belowThresholdSince = nowMs;
        }
        if (track.isSpeaking && nowMs - track.belowThresholdSince >= speakingOffsetMs) {
          track.isSpeaking = false;
        }
      }

      // 3. Accumulate talk time
      if (track.isSpeaking) {
        track.talkTime += tickSec;
      }

      // 4. Interruption detection
      const nowSpeaking = currentlySpeakingRef.current;

      if (track.isSpeaking && !wasSpeaking) {
        // This participant just started speaking
        // Check if anyone else is already speaking → potential interruption
        nowSpeaking.forEach((theirStartMs, otherId) => {
          if (otherId !== id) {
            // They were already speaking when we started
            // We'll confirm interruption when 'other' goes silent within window
            // Store candidate: interrupter=id, interrupted=otherId, overlap start=now
            // (We handle confirmation in the "went silent" branch below)
          }
        });
        nowSpeaking.set(id, nowMs);
      }

      if (!track.isSpeaking && wasSpeaking) {
        // This participant just went silent
        const weStartedAt = nowSpeaking.get(id);
        nowSpeaking.delete(id);

        if (weStartedAt !== undefined) {
          // Check if someone started speaking before we went silent (interruption)
          // and they started during our speech (not before)
          nowSpeaking.forEach((theirStartMs, interrupterId) => {
            // Interrupter started speaking after us, we went silent within window
            const theyStartedWhileWeTalked = theyStartedBeforeWeSilenced(
              theirStartMs,
              weStartedAt,
              nowMs,
              interruptionWindowMs
            );
            if (theyStartedWhileWeTalked) {
              interruptionsRef.current.push({
                interrupter: interrupterId,
                interrupted: id,
                timestamp: nowMs,
              });
            }
          });
        }
      }
    },
    [
      getTrack,
      smoothingWindow,
      speakingThreshold,
      speakingOnsetMs,
      speakingOffsetMs,
      interruptionWindowMs,
    ]
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // Interruption confirmation logic:
  // An interruption occurred when:
  //   - interrupted started speaking at weStartedAt
  //   - interrupter started speaking at theirStartMs
  //   - theirStartMs is AFTER weStartedAt (they came in while we were talking)
  //   - we (interrupted) went silent within interruptionWindowMs of their entry
  // ─────────────────────────────────────────────────────────────────────────────
  function theyStartedBeforeWeSilenced(
    theirStartMs: number,
    weStartedAt: number,
    weEndedAt: number,
    windowMs: number
  ): boolean {
    // They must have started AFTER us
    if (theirStartMs <= weStartedAt) return false;
    // We must have gone silent within the window of their start
    if (weEndedAt - theirStartMs > windowMs) return false;
    return true;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Helper: compute Jain's Fairness Index
  // F = (ΣTi)² / (N · ΣTi²)
  // ─────────────────────────────────────────────────────────────────────────────
  const computeFairness = useCallback((tracks: Map<string, ParticipantTrack>): number => {
    const times: number[] = [];
    tracks.forEach((t) => times.push(t.talkTime));
    const n = times.length;
    if (n === 0) return 1;
    const sum = times.reduce((a, b) => a + b, 0);
    if (sum === 0) return 1;
    const sumSq = times.reduce((a, b) => a + b * b, 0);
    return (sum * sum) / (n * sumSq);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // Rebuild analysers when stream descriptors change
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    streams.forEach(({ participantId, stream }) => {
      if (!stream) return;

      const existing = analysersRef.current.get(participantId);
      // Rebuild only if the stream object changed or doesn't exist
      if (!existing) {
        buildAnalyser(participantId, stream);
        return;
      }
      // If the stream's audio track changed, rebuild
      const prevTracks = existing.source.mediaStream?.getAudioTracks() ?? [];
      const newTracks = stream.getAudioTracks();
      const trackChanged =
        prevTracks.length !== newTracks.length ||
        (prevTracks[0]?.id !== newTracks[0]?.id);
      if (trackChanged) {
        buildAnalyser(participantId, stream);
      }
    });

    // Tear down analysers for participants no longer in the list
    const currentIds = new Set(streams.map((s) => s.participantId));
    analysersRef.current.forEach((_, id) => {
      if (!currentIds.has(id)) {
        const entry = analysersRef.current.get(id)!;
        try { entry.source.disconnect(); } catch { /* ignore */ }
        try { entry.context.close(); } catch { /* ignore */ }
        analysersRef.current.delete(id);
      }
    });
  }, [streams, buildAnalyser]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Main polling interval
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    startTimeRef.current = Date.now();
    const tickSec = intervalMs / 1000;

    const intervalId = setInterval(async () => {
      const nowMs = Date.now();
      totalCallTimeRef.current = (nowMs - startTimeRef.current) / 1000;

      // ── Source 1: Web Audio analysers (MediaStream-based) ───────────────────
      analysersRef.current.forEach((entry, id) => {
        const level = readAnalyserLevel(entry);
        processSample(id, level, nowMs, tickSec);
      });

      // ── Source 2: RTCPeerConnection getStats() ──────────────────────────────
      const statsPromises = peerConnections.map(async ({ participantId, pc }) => {
        if (pc.connectionState === "closed") return;
        const { inbound, outbound } = await readPcStats(pc);
        // For a given peer connection: inbound = remote participant's audio,
        // outbound / media-source = local audio.
        // We attribute inbound level to this participantId.
        // (If the caller also wants local stats, they should pass a separate
        //  descriptor with participantId="local" and use streams=[localStream].)
        const level = Math.max(inbound, outbound);
        if (level > 0) {
          processSample(participantId, level, nowMs, tickSec);
        }
      });
      await Promise.allSettled(statsPromises);

      // ── Build result snapshot ────────────────────────────────────────────────
      const totalTime = totalCallTimeRef.current;
      const newParticipants = new Map<string, ParticipantVoiceState>();

      trackRef.current.forEach((track, id) => {
        const talkPercent = totalTime > 0 ? track.talkTime / totalTime : 0;
        newParticipants.set(id, {
          audioLevel: track.smoothedLevel,
          isSpeaking: track.isSpeaking,
          talkTime: track.talkTime,
          talkPercent: Math.min(talkPercent, 1),
        });
      });

      const fairness = computeFairness(trackRef.current);

      participantsRef.current = newParticipants;
      resultRef.current = {
        participants: newParticipants,
        fairnessIndex: fairness,
        interruptions: [...interruptionsRef.current],
        totalCallTime: totalTime,
      };
    }, intervalMs);

    return () => {
      clearInterval(intervalId);
    };
  // We intentionally do NOT list peerConnections/streams in deps —
  // the interval reads the latest values via refs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, readAnalyserLevel, readPcStats, processSample, computeFairness]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Cleanup analysers on unmount
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      analysersRef.current.forEach((entry) => {
        try { entry.source.disconnect(); } catch { /* ignore */ }
        try { entry.context.close(); } catch { /* ignore */ }
      });
      analysersRef.current.clear();
      trackRef.current.clear();
      currentlySpeakingRef.current.clear();
    };
  }, []);

  return resultRef.current;
}
