/**
 * TalkTimeFairnessPanel
 *
 * Compact overlay panel for group call participants showing:
 *  - Doughnut chart of talk-time distribution per participant
 *  - Per-participant colored speaking indicator (exported as SpeakingIndicator)
 *  - Nudge notification when fairness drops below threshold
 *
 * All data comes from the useVoiceActivity hook (read-only).
 * Collapse / expand with a single click on the header.
 *
 * Usage in CallOverlay:
 *   <TalkTimeFairnessPanel
 *     voiceActivity={voiceActivity}
 *     participantNames={participantNames}  // Map<participantId, displayName>
 *   />
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  memo,
} from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type {
  VoiceActivityResult,
  ParticipantVoiceState,
} from "../hooks/useVoiceActivity";

// ─── Palette ──────────────────────────────────────────────────────────────────

/** 12 distinct colours cycling for participant segments */
const SEGMENT_COLORS: readonly string[] = [
  "#5865f2", // discord accent / indigo
  "#3ba55d", // green
  "#faa81a", // amber
  "#ed4245", // red
  "#00b0f4", // sky
  "#ff7043", // deep-orange
  "#ab47bc", // purple
  "#26c6da", // cyan
  "#ffca28", // yellow
  "#ec407a", // pink
  "#66bb6a", // light-green
  "#7e57c2", // deep-purple
] as const;

function colorForIndex(index: number): string {
  return SEGMENT_COLORS[index % SEGMENT_COLORS.length];
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TalkTimeFairnessPanelProps {
  /** Result object from useVoiceActivity — passed by reference, updated each tick */
  voiceActivity: VoiceActivityResult;
  /**
   * Human-readable names for each participantId.
   * If a name is missing, the participantId itself is shown.
   */
  participantNames?: Map<string, string>;
  /** Jain's Fairness Index threshold below which a nudge is shown. Default: 0.5 */
  nudgeThreshold?: number;
  /** Initial collapsed state. Default: false (expanded). */
  defaultCollapsed?: boolean;
}

export interface SpeakingIndicatorProps {
  /** Whether the participant is actively speaking right now */
  isSpeaking: boolean;
  /**
   * Share of total talk time [0..1] for this participant.
   * Used to determine colour: green / yellow / red.
   */
  talkPercent: number;
  /**
   * Total number of participants in the call.
   * Determines the "fair share" threshold: 1/N.
   */
  participantCount: number;
  /** Optional extra CSS classes */
  className?: string;
  /** Dot size. Default: "md" (12px). */
  size?: "sm" | "md" | "lg";
}

// ─── SpeakingIndicator (exported) ─────────────────────────────────────────────

/**
 * Coloured dot that can be placed next to an avatar.
 * - Green  : participant's share is within fair range  (< 1/N + 0.10)
 * - Yellow : slightly dominant                         (1/N + 0.10  ..  2/N)
 * - Red    : very dominant                             (> 2/N)
 * Pulses with CSS animation while isSpeaking === true.
 */
export const SpeakingIndicator = memo(function SpeakingIndicator({
  isSpeaking,
  talkPercent,
  participantCount,
  className = "",
  size = "md",
}: SpeakingIndicatorProps) {
  const n = Math.max(participantCount, 1);
  const fairShare = 1 / n;

  let colorClass: string;
  if (talkPercent <= fairShare + 0.1) {
    colorClass = "bg-[#3ba55d]"; // green
  } else if (talkPercent <= 2 / n) {
    colorClass = "bg-[#faa81a]"; // yellow
  } else {
    colorClass = "bg-[#ed4245]"; // red
  }

  const sizeClass =
    size === "sm" ? "w-2 h-2" : size === "lg" ? "w-4 h-4" : "w-3 h-3";

  return (
    <span
      className={[
        "inline-block rounded-full flex-shrink-0",
        colorClass,
        sizeClass,
        isSpeaking ? "animate-pulse" : "opacity-60",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={isSpeaking ? "говорит" : "молчит"}
      role="img"
    />
  );
});

// ─── Nudge toast ──────────────────────────────────────────────────────────────

interface NudgeToastProps {
  visible: boolean;
  onHide: () => void;
}

const NudgeToast = memo(function NudgeToast({
  visible,
  onHide,
}: NudgeToastProps) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className={[
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-[70]",
        "flex items-center gap-2",
        "bg-[#2f3136]/95 backdrop-blur-sm border border-[#5865f2]/40",
        "text-white text-sm px-4 py-2.5 rounded-2xl shadow-2xl",
        "transition-all duration-300 pointer-events-auto",
        "max-w-[calc(100vw-2rem)]",
        visible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-4 pointer-events-none",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="select-none" aria-hidden="true">
        💬
      </span>
      <span>Попробуйте дать слово другим участникам</span>
      <button
        onClick={onHide}
        className="ml-2 text-[#72767d] hover:text-white transition-colors text-base leading-none"
        aria-label="Закрыть уведомление"
      >
        ✕
      </button>
    </div>
  );
});

// ─── Custom recharts tooltip ──────────────────────────────────────────────────

interface TooltipPayloadItem {
  name: string;
  value: number;
  payload: {
    name: string;
    seconds: number;
    color: string;
  };
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const pct = (item.value * 100).toFixed(1);
  const sec = item.payload.seconds.toFixed(0);
  return (
    <div className="bg-[#202225]/95 border border-white/10 rounded-lg px-3 py-2 text-xs text-white shadow-lg pointer-events-none">
      <p className="font-semibold mb-0.5">{item.name}</p>
      <p className="text-[#b9bbbe]">
        {pct}% · {sec}с
      </p>
    </div>
  );
}

// ─── Stable snapshot helper ───────────────────────────────────────────────────

interface SnapshotEntry {
  id: string;
  name: string;
  state: ParticipantVoiceState;
  colorIndex: number;
}

/** Build a stable display snapshot from the voiceActivity map. */
function buildSnapshot(
  participants: Map<string, ParticipantVoiceState>,
  participantNames: Map<string, string> | undefined,
  colorIndexMap: React.MutableRefObject<Map<string, number>>
): SnapshotEntry[] {
  const result: SnapshotEntry[] = [];
  let nextIndex = colorIndexMap.current.size;

  participants.forEach((state, id) => {
    if (!colorIndexMap.current.has(id)) {
      colorIndexMap.current.set(id, nextIndex++);
    }
    result.push({
      id,
      name: participantNames?.get(id) ?? id,
      state,
      colorIndex: colorIndexMap.current.get(id)!,
    });
  });

  // Sort by talkTime desc for stable legend ordering
  result.sort((a, b) => b.state.talkTime - a.state.talkTime);
  return result;
}

// ─── Main component ───────────────────────────────────────────────────────────

function TalkTimeFairnessPanel({
  voiceActivity,
  participantNames,
  nudgeThreshold = 0.5,
  defaultCollapsed = false,
}: TalkTimeFairnessPanelProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  // ── Throttled snapshot: update chart at most 1 Hz ─────────────────────────
  const [snapshot, setSnapshot] = useState<SnapshotEntry[]>([]);
  const colorIndexMap = useRef<Map<string, number>>(new Map());
  const lastSnapshotTime = useRef<number>(0);

  // ── Nudge state ────────────────────────────────────────────────────────────
  const [nudgeVisible, setNudgeVisible] = useState(false);
  const lastNudgeTime = useRef<number>(0);
  const nudgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideNudge = useCallback(() => {
    setNudgeVisible(false);
    if (nudgeTimerRef.current) {
      clearTimeout(nudgeTimerRef.current);
      nudgeTimerRef.current = null;
    }
  }, []);

  // ── Drive updates from voiceActivity (polling at ~1Hz for chart,
  //    checking nudge every tick) ─────────────────────────────────────────────
  //
  // voiceActivity is a ref-based object from useVoiceActivity and does NOT
  // trigger React re-renders. We read it inside a setInterval here to
  // pull latest data at our desired frequency without depending on parent
  // re-renders.
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();

      // Update chart snapshot at most 1 Hz
      if (now - lastSnapshotTime.current >= 1000) {
        lastSnapshotTime.current = now;
        setSnapshot(
          buildSnapshot(
            voiceActivity.participants,
            participantNames,
            colorIndexMap
          )
        );
      }

      // Nudge check: fairness < threshold, not shown in last 60s, call has some data
      if (
        voiceActivity.totalCallTime > 10 &&
        voiceActivity.fairnessIndex < nudgeThreshold &&
        now - lastNudgeTime.current >= 60_000 &&
        !nudgeVisible
      ) {
        lastNudgeTime.current = now;
        setNudgeVisible(true);
        nudgeTimerRef.current = setTimeout(() => {
          setNudgeVisible(false);
        }, 5_000);
      }
    }, 200);

    return () => {
      clearInterval(id);
      if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current);
    };
  // voiceActivity and participantNames are intentionally not in deps — they
  // are stable refs read inside the interval.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nudgeThreshold, nudgeVisible]);

  // ── Derived chart data ─────────────────────────────────────────────────────
  const pieData = snapshot
    .filter((e) => e.state.talkTime > 0)
    .map((e) => ({
      name: e.name,
      value: e.state.talkPercent,
      seconds: e.state.talkTime,
      color: colorForIndex(e.colorIndex),
    }));

  // If nobody has spoken yet, show a placeholder slice
  const chartData =
    pieData.length > 0
      ? pieData
      : [{ name: "—", value: 1, seconds: 0, color: "#40444b" }];

  const participantCount = snapshot.length;
  const fairnessPct = (voiceActivity.fairnessIndex * 100).toFixed(0);

  // ── Fairness label colour ──────────────────────────────────────────────────
  let fairnessColor = "#3ba55d"; // green
  if (voiceActivity.fairnessIndex < 0.5) fairnessColor = "#ed4245";
  else if (voiceActivity.fairnessIndex < 0.75) fairnessColor = "#faa81a";

  const totalMin = Math.floor(voiceActivity.totalCallTime / 60);
  const totalSec = Math.floor(voiceActivity.totalCallTime % 60);
  const totalLabel = `${totalMin}:${String(totalSec).padStart(2, "0")}`;

  return (
    <>
      {/* ── Panel ── */}
      <div
        className={[
          // Positioning: top-right of the call overlay
          "fixed top-4 right-4 z-[55]",
          // Sizing
          "w-52 sm:w-60",
          // Visual
          "bg-[#202225]/90 backdrop-blur-md",
          "border border-white/10 rounded-2xl shadow-2xl",
          "select-none overflow-hidden",
          "transition-all duration-200",
        ]
          .filter(Boolean)
          .join(" ")}
        role="region"
        aria-label="Панель активности речи"
      >
        {/* Header / collapse toggle */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className={[
            "w-full flex items-center justify-between",
            "px-3 py-2.5",
            "text-left text-white/90 text-xs font-semibold tracking-wide uppercase",
            "hover:bg-white/5 transition-colors",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-expanded={!collapsed}
          aria-controls="fairness-panel-body"
        >
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true">📊</span>
            <span>Активность речи</span>
          </span>
          <span
            className={[
              "text-[10px] text-[#72767d] transition-transform duration-200",
              collapsed ? "rotate-180" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-hidden="true"
          >
            ▼
          </span>
        </button>

        {/* Body */}
        <div
          id="fairness-panel-body"
          className={[
            "transition-all duration-200 overflow-hidden",
            collapsed ? "max-h-0" : "max-h-[480px]",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div className="px-3 pb-3 flex flex-col gap-2">
            {/* Doughnut chart */}
            <div className="w-full" style={{ height: 140 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius="52%"
                    outerRadius="80%"
                    paddingAngle={pieData.length > 1 ? 3 : 0}
                    dataKey="value"
                    isAnimationActive={false}
                    strokeWidth={0}
                  >
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={<CustomTooltip />}
                    wrapperStyle={{ outline: "none" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Fairness index row */}
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[#72767d] text-[11px]">Равномерность</span>
              <span
                className="text-[11px] font-bold tabular-nums"
                style={{ color: fairnessColor }}
              >
                {fairnessPct}%
              </span>
            </div>

            {/* Total call time */}
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[#72767d] text-[11px]">Время звонка</span>
              <span className="text-[#b9bbbe] text-[11px] tabular-nums">
                {totalLabel}
              </span>
            </div>

            {/* Divider */}
            <div className="border-t border-white/10 my-0.5" />

            {/* Participant rows */}
            <ul className="flex flex-col gap-1.5" role="list">
              {snapshot.length === 0 && (
                <li className="text-[#72767d] text-[11px] text-center py-1">
                  Нет участников
                </li>
              )}
              {snapshot.map((entry) => (
                <ParticipantRow
                  key={entry.id}
                  entry={entry}
                  participantCount={participantCount}
                />
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ── Nudge toast (outside panel so it renders even when collapsed) ── */}
      <NudgeToast visible={nudgeVisible} onHide={hideNudge} />
    </>
  );
}

// ─── ParticipantRow (internal, memoised) ─────────────────────────────────────

interface ParticipantRowProps {
  entry: SnapshotEntry;
  participantCount: number;
}

const ParticipantRow = memo(function ParticipantRow({
  entry,
  participantCount,
}: ParticipantRowProps) {
  const { state, name, colorIndex } = entry;
  const color = colorForIndex(colorIndex);
  const pct = (state.talkPercent * 100).toFixed(0);
  const sec = state.talkTime.toFixed(0);

  return (
    <li className="flex items-center gap-2" role="listitem">
      {/* Speaking indicator */}
      <SpeakingIndicator
        isSpeaking={state.isSpeaking}
        talkPercent={state.talkPercent}
        participantCount={participantCount}
        size="md"
        className="flex-shrink-0"
      />

      {/* Colour swatch from chart */}
      <span
        className="w-2 h-2 rounded-sm flex-shrink-0"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />

      {/* Name */}
      <span
        className="flex-1 text-[11px] text-[#b9bbbe] truncate min-w-0"
        title={name}
      >
        {name}
      </span>

      {/* Stats */}
      <span className="text-[10px] text-[#72767d] tabular-nums flex-shrink-0">
        {pct}%
      </span>
      <span className="text-[10px] text-[#72767d] tabular-nums flex-shrink-0 w-10 text-right">
        {sec}с
      </span>
    </li>
  );
});

export default memo(TalkTimeFairnessPanel);
