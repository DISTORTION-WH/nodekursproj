import React, { useEffect, useState, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  ReferenceLine,
  Cell,
} from "recharts";
import { getCallHistory, getCallSessionDetail } from "../services/api";

// ─── Types (mirror the backend response shapes) ───────────────────────────────

interface CallHistoryItem {
  id: string;
  started_at: string;
  ended_at: string;
  participant_count: number;
  fairness_index: number;
  my_talk_time_seconds: number;
  my_talk_percent: number;
  my_interruptions_made: number;
  my_interruptions_received: number;
}

interface ParticipantStatRow {
  id: string;
  user_id: number;
  username: string;
  avatar_url: string | null;
  talk_time_seconds: number;
  talk_percent: number;
  interruptions_made: number;
  interruptions_received: number;
  avg_audio_level: number;
}

interface InterruptionEventRow {
  id: string;
  interrupter_user_id: number;
  interrupter_username: string;
  interrupted_user_id: number;
  interrupted_username: string;
  occurred_at: string;
}

interface CallSessionDetail {
  id: string;
  started_at: string;
  ended_at: string;
  participant_count: number;
  fairness_index: number;
  participants: ParticipantStatRow[];
  interruptions: InterruptionEventRow[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(startedAt: string, endedAt: string): string {
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

function formatDatetime(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Jain's Fairness Index colour */
function fairnessColor(f: number): string {
  if (f >= 0.75) return "#3ba55d"; // green
  if (f >= 0.5)  return "#faa81a"; // yellow
  return "#ed4245";                 // red
}

function fairnessLabel(f: number): string {
  if (f >= 0.75) return "Хорошо";
  if (f >= 0.5)  return "Умеренно";
  return "Неравномерно";
}

const SEGMENT_COLORS = [
  "#5865f2", "#3ba55d", "#faa81a", "#ed4245",
  "#00b0f4", "#ff7043", "#ab47bc", "#26c6da",
];

// ─── Custom tooltip for BarChart ──────────────────────────────────────────────

interface BarTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: { name: string; seconds: number } }>;
}

function BarTooltip({ active, payload }: BarTooltipProps) {
  if (!active || !payload?.length) return null;
  const { name, seconds } = payload[0].payload;
  const pct = (payload[0].value * 100).toFixed(1);
  const sec = seconds.toFixed(0);
  return (
    <div className="bg-[#202225]/95 border border-white/10 rounded-lg px-3 py-2 text-xs text-white shadow-lg">
      <p className="font-semibold mb-0.5">{name}</p>
      <p className="text-[#b9bbbe]">{pct}% · {sec}с</p>
    </div>
  );
}

// ─── Custom tooltip for LineChart ─────────────────────────────────────────────

interface LineTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function LineTooltip({ active, payload, label }: LineTooltipProps) {
  if (!active || !payload?.length) return null;
  const val = (payload[0].value * 100).toFixed(0);
  return (
    <div className="bg-[#202225]/95 border border-white/10 rounded-lg px-3 py-2 text-xs text-white shadow-lg">
      <p className="text-[#b9bbbe] mb-0.5">{label}</p>
      <p className="font-semibold">Fairness: {val}%</p>
    </div>
  );
}

// ─── Session detail card ──────────────────────────────────────────────────────

interface SessionDetailProps {
  callId: string;
  onClose: () => void;
}

function SessionDetail({ callId, onClose }: SessionDetailProps) {
  const [detail, setDetail] = useState<CallSessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getCallSessionDetail(callId)
      .then((res) => setDetail(res.data))
      .catch(() => setError("Не удалось загрузить детали звонка"))
      .finally(() => setLoading(false));
  }, [callId]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-3 mt-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 bg-discord-input rounded" />
        ))}
      </div>
    );
  }

  if (error || !detail) {
    return <p className="text-discord-danger text-sm mt-3">{error ?? "Ошибка"}</p>;
  }

  // Bar chart data — talk percent
  const barData = detail.participants.map((p, i) => ({
    name: p.username,
    value: p.talk_percent,
    seconds: p.talk_time_seconds,
    color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
  }));

  const fc = fairnessColor(detail.fairness_index);
  const fl = fairnessLabel(detail.fairness_index);

  return (
    <div className="mt-4 space-y-5">
      {/* Fairness badge */}
      <div className="flex items-center gap-3">
        <span className="text-discord-text-secondary text-sm">Индекс равномерности:</span>
        <span
          className="text-sm font-bold px-2 py-0.5 rounded"
          style={{ color: fc, backgroundColor: `${fc}22`, border: `1px solid ${fc}44` }}
        >
          {(detail.fairness_index * 100).toFixed(0)}% — {fl}
        </span>
      </div>

      {/* Bar chart: talk time distribution */}
      <div>
        <p className="text-discord-text-secondary text-xs mb-2 uppercase tracking-wide">
          Распределение времени речи
        </p>
        <div style={{ height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#40444b" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: "#b9bbbe", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                tick={{ fill: "#72767d", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<BarTooltip />} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {barData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Participant stats table */}
      <div>
        <p className="text-discord-text-secondary text-xs mb-2 uppercase tracking-wide">
          Участники
        </p>
        <div className="rounded-lg overflow-hidden border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-discord-tertiary text-discord-text-muted text-xs">
                <th className="text-left px-3 py-2">Участник</th>
                <th className="text-right px-3 py-2">Время речи</th>
                <th className="text-right px-3 py-2">% времени</th>
                <th className="text-right px-3 py-2">Перебил</th>
                <th className="text-right px-3 py-2">Перебили</th>
              </tr>
            </thead>
            <tbody>
              {detail.participants.map((p, i) => (
                <tr
                  key={p.id}
                  className="border-t border-white/5 hover:bg-white/5 transition-colors"
                >
                  <td className="px-3 py-2 flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }}
                    />
                    <span className="text-discord-text-primary">{p.username}</span>
                  </td>
                  <td className="px-3 py-2 text-right text-discord-text-secondary tabular-nums">
                    {p.talk_time_seconds.toFixed(0)}с
                  </td>
                  <td className="px-3 py-2 text-right text-discord-text-secondary tabular-nums">
                    {(p.talk_percent * 100).toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <span className={p.interruptions_made > 0 ? "text-discord-warn" : "text-discord-text-muted"}>
                      {p.interruptions_made}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <span className={p.interruptions_received > 0 ? "text-discord-danger" : "text-discord-text-muted"}>
                      {p.interruptions_received}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Interruption events */}
      {detail.interruptions.length > 0 && (
        <div>
          <p className="text-discord-text-secondary text-xs mb-2 uppercase tracking-wide">
            Перебивания ({detail.interruptions.length})
          </p>
          <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {detail.interruptions.map((ev) => (
              <li
                key={ev.id}
                className="flex items-center gap-2 text-xs bg-discord-input rounded-lg px-3 py-2"
              >
                <span className="text-discord-text-muted tabular-nums w-16 flex-shrink-0">
                  {formatTime(ev.occurred_at)}
                </span>
                <span className="text-discord-warn font-medium">{ev.interrupter_username}</span>
                <span className="text-discord-text-muted">перебил(а)</span>
                <span className="text-discord-text-primary font-medium">{ev.interrupted_username}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={onClose}
        className="text-xs text-discord-text-muted hover:text-discord-text-primary transition mt-1"
      >
        ▲ Свернуть детали
      </button>
    </div>
  );
}

// ─── Fairness trend line chart ────────────────────────────────────────────────

interface FairnessTrendProps {
  history: CallHistoryItem[];
}

function FairnessTrend({ history }: FairnessTrendProps) {
  // Show newest at the right — slice last 20
  const data = [...history]
    .slice(0, 20)
    .reverse()
    .map((item, i) => ({
      name: `#${i + 1}`,
      date: formatDatetime(item.started_at),
      value: item.fairness_index,
    }));

  if (data.length < 2) return null;

  return (
    <div className="bg-discord-secondary rounded-xl p-5 mb-6">
      <h3 className="text-discord-text-primary font-semibold mb-3 text-sm">
        Динамика равномерности разговора
      </h3>
      <div style={{ height: 140 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#40444b" />
            <XAxis
              dataKey="name"
              tick={{ fill: "#72767d", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 1]}
              tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
              tick={{ fill: "#72767d", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<LineTooltip />} />
            {/* Reference lines at 50% and 75% */}
            <ReferenceLine y={0.75} stroke="#3ba55d" strokeDasharray="4 4" strokeWidth={1} />
            <ReferenceLine y={0.5}  stroke="#faa81a" strokeDasharray="4 4" strokeWidth={1} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#5865f2"
              strokeWidth={2}
              dot={{ fill: "#5865f2", r: 3 }}
              activeDot={{ r: 5, fill: "#5865f2" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-4 mt-2 text-[10px] text-discord-text-muted">
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-[#3ba55d] inline-block" /> ≥75% — хорошо
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-[#faa81a] inline-block" /> ≥50% — умеренно
        </span>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CallHistoryPage() {
  const [history, setHistory] = useState<CallHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getCallHistory(50)
      .then((res) => setHistory(res.data))
      .catch(() => setError("Не удалось загрузить историю звонков"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="flex-1 overflow-y-auto bg-discord-bg p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white text-2xl font-bold flex items-center gap-2">
            <span>📞</span> История звонков
          </h2>
          <button
            onClick={load}
            disabled={loading}
            className="text-sm px-3 py-1.5 rounded bg-discord-input hover:bg-discord-input-hover text-discord-text-secondary hover:text-white transition disabled:opacity-50"
          >
            {loading ? "Загрузка…" : "Обновить"}
          </button>
        </div>

        {error && (
          <div className="bg-discord-danger/20 border border-discord-danger/40 rounded-lg px-4 py-3 text-discord-danger text-sm mb-4">
            {error}
          </div>
        )}

        {/* Fairness trend */}
        {!loading && history.length >= 2 && <FairnessTrend history={history} />}

        {/* Empty state */}
        {!loading && history.length === 0 && !error && (
          <div className="text-center py-16 text-discord-text-muted">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-lg">История звонков пуста</p>
            <p className="text-sm mt-1">Ваши звонки появятся здесь после завершения</p>
          </div>
        )}

        {/* Skeleton while loading */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="animate-pulse bg-discord-secondary rounded-xl h-[72px]"
              />
            ))}
          </div>
        )}

        {/* History list */}
        {!loading && history.length > 0 && (
          <ul className="space-y-3">
            {history.map((item) => {
              const isExpanded = expandedId === item.id;
              const fc = fairnessColor(item.fairness_index);
              const duration = formatDuration(item.started_at, item.ended_at);

              return (
                <li
                  key={item.id}
                  className="bg-discord-secondary rounded-xl border border-white/5 hover:border-white/10 transition-colors overflow-hidden"
                >
                  {/* Row */}
                  <button
                    className="w-full text-left px-5 py-4 flex items-center gap-4"
                    onClick={() => toggleExpand(item.id)}
                    aria-expanded={isExpanded}
                  >
                    {/* Date/time */}
                    <div className="flex-shrink-0 min-w-[130px]">
                      <p className="text-discord-text-primary text-sm font-medium">
                        {formatDatetime(item.started_at)}
                      </p>
                      <p className="text-discord-text-muted text-xs mt-0.5">
                        {duration} · {item.participant_count} уч.
                      </p>
                    </div>

                    {/* My talk time */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-xs text-discord-text-secondary mb-1">
                        <span>Моё время речи:</span>
                        <span className="text-discord-text-primary font-medium tabular-nums">
                          {item.my_talk_time_seconds.toFixed(0)}с
                          ({(item.my_talk_percent * 100).toFixed(0)}%)
                        </span>
                      </div>
                      {/* Thin progress bar */}
                      <div className="h-1.5 bg-discord-tertiary rounded-full overflow-hidden w-full max-w-xs">
                        <div
                          className="h-full bg-discord-accent rounded-full"
                          style={{ width: `${Math.min(item.my_talk_percent * 100, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Interruptions */}
                    <div className="flex-shrink-0 text-center hidden sm:block">
                      <p
                        className="text-sm font-semibold tabular-nums"
                        style={{ color: item.my_interruptions_made > 0 ? "#faa81a" : "#72767d" }}
                      >
                        {item.my_interruptions_made}
                      </p>
                      <p className="text-[10px] text-discord-text-muted">перебил</p>
                    </div>

                    {/* Fairness index */}
                    <div className="flex-shrink-0 text-center w-16">
                      <p
                        className="text-base font-bold tabular-nums"
                        style={{ color: fc }}
                      >
                        {(item.fairness_index * 100).toFixed(0)}%
                      </p>
                      <p className="text-[10px] text-discord-text-muted">fairness</p>
                    </div>

                    {/* Expand chevron */}
                    <span
                      className={[
                        "flex-shrink-0 text-discord-text-muted text-xs transition-transform duration-200",
                        isExpanded ? "rotate-180" : "",
                      ].join(" ")}
                    >
                      ▼
                    </span>
                  </button>

                  {/* Detail panel */}
                  {isExpanded && (
                    <div className="px-5 pb-5 border-t border-white/5">
                      <SessionDetail
                        callId={item.id}
                        onClose={() => setExpandedId(null)}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
