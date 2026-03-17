import React, { useState } from "react";
import type { NetworkMetrics, Prediction } from "../hooks/usePredictiveQuality";
import { useCallFeatures } from "../context/CallFeaturesContext";

// ─── Props (all optional — fall back to CallFeaturesContext when omitted) ─────

export interface NetworkQualityIndicatorProps {
  metrics?: NetworkMetrics | null;
  prediction?: Prediction;
  currentBitrate?: number | null;
  isAdapting?: boolean;
}

// ─── Quality level derivation ─────────────────────────────────────────────────

type QualityLevel = 1 | 2 | 3 | 4;

function getQualityLevel(
  metrics: NetworkMetrics | null,
  prediction: Prediction,
  isAdapting: boolean
): QualityLevel {
  if (isAdapting) return 1;
  if (prediction.degradationPredicted) return 2;
  if (!metrics) return 4;

  const { roundTripTime, jitter, lossRate } = metrics;

  // Bad
  if (roundTripTime > 0.3 || lossRate > 0.05 || jitter > 0.05) return 1;
  // Warning
  if (roundTripTime > 0.15 || lossRate > 0.02 || jitter > 0.025) return 2;
  // OK
  if (roundTripTime > 0.08 || lossRate > 0.01 || jitter > 0.012) return 3;
  // Good
  return 4;
}

// ─── Bar colours ──────────────────────────────────────────────────────────────

const LEVEL_COLOR: Record<QualityLevel, string> = {
  4: "#3ba55d",
  3: "#3ba55d",
  2: "#faa81a",
  1: "#ed4245",
};

// ─── Bars component ───────────────────────────────────────────────────────────

function SignalBars({ level, color }: { level: QualityLevel; color: string }) {
  // 4 bars of increasing height
  const heights = [4, 7, 10, 13]; // px
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 2,
        height: 14,
      }}
    >
      {heights.map((h, i) => {
        const barIndex = (i + 1) as QualityLevel;
        const filled = barIndex <= level;
        return (
          <div
            key={i}
            style={{
              width: 4,
              height: h,
              borderRadius: 1,
              background: filled ? color : "rgba(255,255,255,0.2)",
              transition: "background 0.3s ease",
            }}
          />
        );
      })}
    </div>
  );
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function Tooltip({
  metrics,
  prediction,
  currentBitrate,
  isAdapting,
}: NetworkQualityIndicatorProps) {
  const fmt = (v: number, unit: string, mult = 1, decimals = 0) =>
    `${(v * mult).toFixed(decimals)} ${unit}`;

  const bitrateLabel = currentBitrate
    ? `${(currentBitrate / 1000).toFixed(0)} kbps`
    : "авто";

  return (
    <div
      style={{
        position: "absolute",
        bottom: "calc(100% + 6px)",
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(0,0,0,0.88)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 8,
        padding: "8px 12px",
        whiteSpace: "nowrap",
        fontSize: "0.7rem",
        color: "#e3e5e8",
        pointerEvents: "none",
        zIndex: 100,
        lineHeight: 1.7,
      }}
    >
      {metrics ? (
        <>
          <div>RTT: <b>{fmt(metrics.roundTripTime, "мс", 1000, 0)}</b></div>
          <div>Jitter: <b>{fmt(metrics.jitter, "мс", 1000, 0)}</b></div>
          <div>Потери: <b>{fmt(metrics.lossRate, "%", 100, 1)}</b></div>
          {metrics.availableOutgoingBitrate > 0 && (
            <div>Пропускная способность: <b>{fmt(metrics.availableOutgoingBitrate, "kbps", 0.001, 0)}</b></div>
          )}
          <div>Видео битрейт: <b>{bitrateLabel}</b></div>
          {prediction.degradationPredicted && (
            <div style={{ color: "#faa81a", marginTop: 2 }}>
              Прогноз RTT: {fmt(prediction.predictedRTT, "мс", 1000, 0)},
              {" "}потери: {fmt(prediction.predictedLoss, "%", 100, 1)}
            </div>
          )}
          {isAdapting && (
            <div style={{ color: "#ed4245", marginTop: 2 }}>Адаптация битрейта...</div>
          )}
        </>
      ) : (
        <div style={{ color: "rgba(255,255,255,0.4)" }}>Сбор метрик...</div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function NetworkQualityIndicator({
  metrics: metricsProp,
  prediction: predictionProp,
  currentBitrate: currentBitrateProp,
  isAdapting: isAdaptingProp,
}: NetworkQualityIndicatorProps) {
  const ctx = useCallFeatures();
  const metrics       = metricsProp       !== undefined ? metricsProp       : ctx.networkQuality.metrics;
  const prediction    = predictionProp    !== undefined ? predictionProp    : ctx.networkQuality.prediction;
  const currentBitrate = currentBitrateProp !== undefined ? currentBitrateProp : ctx.networkQuality.currentBitrate;
  const isAdapting    = isAdaptingProp    !== undefined ? isAdaptingProp    : ctx.networkQuality.isAdapting;

  const [hovered, setHovered] = useState(false);

  const level = getQualityLevel(metrics ?? null, prediction, isAdapting);
  const color = LEVEL_COLOR[level];

  return (
    <div
      style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 4 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Signal bars */}
      <div
        style={{
          animation: isAdapting ? "nqi-pulse 1.2s ease-in-out infinite" : "none",
          display: "flex",
          alignItems: "center",
          cursor: "default",
        }}
      >
        <SignalBars level={level} color={color} />
      </div>

      {/* "Адаптация..." label */}
      {isAdapting && (
        <span
          style={{
            fontSize: "0.65rem",
            color: "#ed4245",
            fontWeight: 500,
            animation: "nqi-pulse 1.2s ease-in-out infinite",
            whiteSpace: "nowrap",
          }}
        >
          Адаптация...
        </span>
      )}

      {/* Tooltip on hover */}
      {hovered && (
        <Tooltip
          metrics={metrics}
          prediction={prediction}
          currentBitrate={currentBitrate}
          isAdapting={isAdapting}
        />
      )}

      {/* Keyframe injected once via a style tag */}
      <style>{`
        @keyframes nqi-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
