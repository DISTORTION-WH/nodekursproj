import { useEffect, useRef, useState, useCallback } from "react";

// ─── Public interfaces ────────────────────────────────────────────────────────

export interface NetworkMetrics {
  roundTripTime: number;      // seconds
  jitter: number;             // seconds
  lossRate: number;           // fraction [0..1]
  availableOutgoingBitrate: number; // bps
  timestamp: number;          // ms epoch
}

export interface Prediction {
  degradationPredicted: boolean;
  /** 0..1, higher = more data points → more reliable */
  confidence: number;
  predictedRTT: number;       // seconds, 2 s ahead
  predictedLoss: number;      // fraction, 2 s ahead
  predictedJitter: number;    // seconds, 2 s ahead
}

export interface UsePredictiveQualityResult {
  metrics: NetworkMetrics | null;
  prediction: Prediction;
  /** Current enforced max video bitrate in bps, or null when not constrained */
  currentBitrate: number | null;
  /** True while actively throttling / recovering bitrate */
  isAdapting: boolean;
}

export interface UsePredictiveQualityOptions {
  /** RTCPeerConnection to monitor */
  pc: RTCPeerConnection | null;
  /** RTCRtpSender for the video track (used to throttle bitrate) */
  videoSender?: RTCRtpSender | null;
  /** Polling interval in ms (default 200) */
  intervalMs?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_MS         = 200;
const WINDOW_MS       = 30_000;   // 30 s history
const TREND_MS        = 5_000;    // 5 s for regression
const EXTRAPOLATE_S   = 2;        // predict 2 s ahead

const RTT_THRESHOLD   = 0.300;    // 300 ms
const LOSS_THRESHOLD  = 0.05;     // 5 %
const JITTER_THRESHOLD = 0.050;   // 50 ms

const BITRATE_LOW     = 500_000;  // 500 kbps — degraded target
const BITRATE_HIGH    = 2_500_000;// 2.5 Mbps — normal target
const BITRATE_STEP    = 200_000;  // +200 kbps recovery step
const RECOVERY_MS     = 2_000;    // recovery step interval

const DEFAULT_PREDICTION: Prediction = {
  degradationPredicted: false,
  confidence: 0,
  predictedRTT: 0,
  predictedLoss: 0,
  predictedJitter: 0,
};

// ─── Prediction model ─────────────────────────────────────────────────────────
//
// Holt's Double Exponential Smoothing (DES) combined with weighted least-squares
// regression. DES tracks both the current level and the trend of the series,
// making it well-suited for non-stationary network metrics that can spike or
// recover rapidly.
//
// α (level smoothing):  how quickly the level adapts to new data [0..1]
// β (trend smoothing):  how quickly the trend estimate adapts     [0..1]
// Higher α/β = more reactive; lower = smoother but slower.

const ALPHA = 0.4; // level smoothing
const BETA  = 0.3; // trend smoothing

interface HoltState {
  level: number;
  trend: number;
}

/**
 * Run Holt's DES over `y` with exponentially increasing sample weights.
 * Returns the smoothed (level, trend) at the last observed point.
 */
function holtSmooth(y: number[]): HoltState {
  if (y.length === 0) return { level: 0, trend: 0 };
  if (y.length === 1) return { level: y[0], trend: 0 };

  // Initialise: level = first value, trend = first difference (no look-ahead)
  let level = y[0];
  let trend = y[1] - y[0];

  for (let i = 1; i < y.length; i++) {
    const prevLevel = level;
    level = ALPHA * y[i] + (1 - ALPHA) * (level + trend);
    trend = BETA  * (level - prevLevel) + (1 - BETA) * trend;
  }
  return { level, trend };
}

/**
 * Weighted least-squares regression where sample weight increases
 * exponentially with recency (decay factor λ per sample).
 */
function weightedRegression(y: number[]): { slope: number; intercept: number } {
  const n = y.length;
  if (n < 2) return { slope: 0, intercept: y[0] ?? 0 };

  const λ = 0.85; // decay per sample (older samples have weight λ^k)
  let wSum = 0, wxSum = 0, wySum = 0, wxxSum = 0, wxySum = 0;

  for (let i = 0; i < n; i++) {
    const w = Math.pow(λ, n - 1 - i); // weight: highest for newest point
    wSum   += w;
    wxSum  += w * i;
    wySum  += w * y[i];
    wxxSum += w * i * i;
    wxySum += w * i * y[i];
  }

  const denom = wSum * wxxSum - wxSum * wxSum;
  if (denom === 0) return { slope: 0, intercept: wySum / wSum };
  const slope     = (wSum * wxySum - wxSum * wySum) / denom;
  const intercept = (wySum - slope * wxSum) / wSum;
  return { slope, intercept };
}

/**
 * Extrapolate `stepsAhead` samples into the future using a blend of
 * Holt DES (captures trend) and weighted regression (captures long-run slope).
 * The two estimates are averaged to reduce variance.
 */
function extrapolate(y: number[], stepsAhead: number): number {
  // Holt DES forecast: level + trend × steps
  const { level, trend } = holtSmooth(y);
  const holtForecast = level + trend * stepsAhead;

  // Weighted regression forecast
  const { slope, intercept } = weightedRegression(y);
  const wlsForecast = intercept + slope * (y.length - 1 + stepsAhead);

  // Equal-weight blend; both models see different aspects of the series
  return (holtForecast + wlsForecast) / 2;
}

// ─── Stats extraction ─────────────────────────────────────────────────────────

interface RawSnapshot {
  roundTripTime: number;
  jitter: number;
  packetsLost: number;
  packetsReceived: number;
  availableOutgoingBitrate: number;
}

async function pollStats(pc: RTCPeerConnection): Promise<RawSnapshot | null> {
  let rtt = 0;
  let jitter = 0;
  let packetsLost = 0;
  let packetsReceived = 0;
  let availableBitrate = 0;

  let hasCandidatePair = false;
  let hasInbound = false;

  try {
    const report = await pc.getStats();

    report.forEach((stat) => {
      // candidate-pair: RTT + available outgoing bitrate
      if (stat.type === "candidate-pair" && (stat as RTCIceCandidatePairStats).state === "succeeded") {
        const cp = stat as RTCIceCandidatePairStats;
        if (typeof cp.currentRoundTripTime === "number") {
          rtt = cp.currentRoundTripTime;
          hasCandidatePair = true;
        }
        if (typeof (cp as RTCIceCandidatePairStats & { availableOutgoingBitrate?: number }).availableOutgoingBitrate === "number") {
          availableBitrate = (cp as RTCIceCandidatePairStats & { availableOutgoingBitrate?: number }).availableOutgoingBitrate!;
        }
      }

      // inbound-rtp audio track: jitter + packet loss
      if (stat.type === "inbound-rtp") {
        const inbound = stat as RTCInboundRtpStreamStats;
        if ((inbound as RTCInboundRtpStreamStats & { kind?: string }).kind === "audio" ||
            (inbound as RTCInboundRtpStreamStats & { mediaType?: string }).mediaType === "audio") {
          if (typeof inbound.jitter === "number") jitter = inbound.jitter;
          if (typeof inbound.packetsLost === "number") packetsLost = inbound.packetsLost;
          if (typeof inbound.packetsReceived === "number") packetsReceived = inbound.packetsReceived;
          hasInbound = true;
        }
      }
    });
  } catch {
    return null;
  }

  if (!hasCandidatePair && !hasInbound) return null;

  return { roundTripTime: rtt, jitter, packetsLost, packetsReceived, availableOutgoingBitrate: availableBitrate };
}

// ─── Bitrate enforcement ──────────────────────────────────────────────────────

async function applyBitrate(sender: RTCRtpSender, maxBitrate: number): Promise<void> {
  try {
    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) return;
    params.encodings.forEach((enc) => {
      enc.maxBitrate = maxBitrate;
    });
    await sender.setParameters(params);
  } catch {
    // setParameters may fail if connection is renegotiating — ignore
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePredictiveQuality({
  pc,
  videoSender = null,
  intervalMs = POLL_MS,
}: UsePredictiveQualityOptions): UsePredictiveQualityResult {
  const [result, setResult] = useState<UsePredictiveQualityResult>({
    metrics: null,
    prediction: DEFAULT_PREDICTION,
    currentBitrate: null,
    isAdapting: false,
  });

  // Sliding window: store NetworkMetrics[] for up to WINDOW_MS
  const historyRef = useRef<NetworkMetrics[]>([]);

  // Packet counters from previous sample (for delta loss calculation)
  const prevPacketsRef = useRef<{ lost: number; received: number } | null>(null);

  // Bitrate state tracked in ref to avoid stale closure in setInterval
  const bitrateRef = useRef<number | null>(null);
  const isAdaptingRef = useRef(false);
  const lastRecoveryRef = useRef<number>(0);

  // Expose setter so we can sync to React state from the interval
  const flushRef = useRef<(snapshot: Omit<UsePredictiveQualityResult, never>) => void>(() => {});
  flushRef.current = setResult;

  const senderRef = useRef(videoSender);
  senderRef.current = videoSender;

  const pcRef = useRef(pc);
  pcRef.current = pc;

  const computePrediction = useCallback((history: NetworkMetrics[]): Prediction => {
    // Use only the last TREND_MS worth of samples
    const now = Date.now();
    const trend = history.filter((m) => now - m.timestamp <= TREND_MS);

    if (trend.length < 3) {
      return { ...DEFAULT_PREDICTION, confidence: 0 };
    }

    const rtts    = trend.map((m) => m.roundTripTime);
    const losses  = trend.map((m) => m.lossRate);
    const jitters = trend.map((m) => m.jitter);

    // Steps ahead: EXTRAPOLATE_S / (intervalMs / 1000)
    const stepsAhead = Math.round((EXTRAPOLATE_S * 1000) / intervalMs);

    const predictedRTT    = Math.max(0, extrapolate(rtts, stepsAhead));
    const predictedLoss   = Math.max(0, Math.min(1, extrapolate(losses, stepsAhead)));
    const predictedJitter = Math.max(0, extrapolate(jitters, stepsAhead));

    const degradationPredicted =
      predictedRTT    > RTT_THRESHOLD    ||
      predictedLoss   > LOSS_THRESHOLD   ||
      predictedJitter > JITTER_THRESHOLD;

    // confidence: 0 at 3 points, 1 at full TREND_MS window
    const maxPoints = TREND_MS / intervalMs;
    const confidence = Math.min(1, (trend.length - 3) / Math.max(1, maxPoints - 3));

    return { degradationPredicted, confidence, predictedRTT, predictedLoss, predictedJitter };
  }, [intervalMs]);

  useEffect(() => {
    if (!pc) return;
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      const currentPc = pcRef.current;
      if (!currentPc) return;
      const raw = await pollStats(currentPc);
      if (!raw) return;

      // Compute delta packet loss rate
      const prev = prevPacketsRef.current;
      let lossRate = 0;
      if (prev !== null) {
        const deltaLost     = Math.max(0, raw.packetsLost     - prev.lost);
        const deltaReceived = Math.max(0, raw.packetsReceived - prev.received);
        const total = deltaLost + deltaReceived;
        lossRate = total > 0 ? deltaLost / total : 0;
      }
      prevPacketsRef.current = { lost: raw.packetsLost, received: raw.packetsReceived };

      const metrics: NetworkMetrics = {
        roundTripTime: raw.roundTripTime,
        jitter: raw.jitter,
        lossRate,
        availableOutgoingBitrate: raw.availableOutgoingBitrate,
        timestamp: Date.now(),
      };

      // Append to sliding window, evict old entries
      const window = historyRef.current;
      window.push(metrics);
      const cutoff = Date.now() - WINDOW_MS;
      while (window.length > 0 && window[0].timestamp < cutoff) window.shift();

      // Compute prediction
      const prediction = computePrediction(window);

      // ── Bitrate adaptation ─────────────────────────────────────────────────
      const now = Date.now();
      let currentBitrate = bitrateRef.current;
      let isAdapting = isAdaptingRef.current;

      if (prediction.degradationPredicted) {
        // Throttle video to BITRATE_LOW immediately
        if (currentBitrate === null || currentBitrate > BITRATE_LOW) {
          currentBitrate = BITRATE_LOW;
          bitrateRef.current = currentBitrate;
          isAdapting = true;
          isAdaptingRef.current = true;
          const sender = senderRef.current;
          if (sender && !cancelled) {
            applyBitrate(sender, BITRATE_LOW);
          }
        }
      } else if (isAdapting) {
        // Recovery: step up every RECOVERY_MS, stop at BITRATE_HIGH
        if (now - lastRecoveryRef.current >= RECOVERY_MS) {
          lastRecoveryRef.current = now;
          const next = Math.min(BITRATE_HIGH, (currentBitrate ?? BITRATE_LOW) + BITRATE_STEP);
          currentBitrate = next;
          bitrateRef.current = next;
          const sender = senderRef.current;
          if (sender && !cancelled) {
            applyBitrate(sender, next);
          }
          if (next >= BITRATE_HIGH) {
            isAdapting = false;
            isAdaptingRef.current = false;
            currentBitrate = null;
            bitrateRef.current = null;
          }
        }
      }

      flushRef.current({ metrics, prediction, currentBitrate, isAdapting });
    };

    const id = setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
      historyRef.current = [];
      prevPacketsRef.current = null;
      bitrateRef.current = null;
      isAdaptingRef.current = false;
      lastRecoveryRef.current = 0;
    };
  }, [pc, intervalMs, computePrediction]);

  return result;
}
