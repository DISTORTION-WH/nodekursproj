import React, { useState, useEffect } from "react";
import api from "../../services/api";
import { LogEntry } from "../../types";

export default function LogsViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const fetchLogs = () => {
    api
      .get<LogEntry[]>("/admin/logs?limit=50")
      .then((res) => setLogs(res.data))
      .catch(console.error);
  };

  useEffect(() => { fetchLogs(); }, []);

  const levelColor = (level: string) => {
    switch (level.toUpperCase()) {
      case "ERROR": return "bg-discord-danger/20 text-discord-danger";
      case "WARN": case "WARNING": return "bg-yellow-500/20 text-yellow-400";
      case "INFO": return "bg-discord-accent/20 text-discord-accent";
      default: return "bg-white/10 text-discord-text-secondary";
    }
  };

  return (
    <div className="bg-discord-secondary rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold text-base">Системные логи (50)</h3>
        <button
          onClick={fetchLogs}
          className="bg-discord-input hover:bg-discord-input-hover text-discord-text-secondary hover:text-white text-xs px-3 py-1.5 rounded transition"
        >
          🔄 Обновить
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-discord-text-muted text-xs uppercase border-b border-white/10">
              <th className="text-left py-2 px-2">Время</th>
              <th className="text-left py-2 px-2">Уровень</th>
              <th className="text-left py-2 px-2">Сообщение</th>
              <th className="text-left py-2 px-2">Детали</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr
                key={log.id}
                className={`border-b border-white/5 hover:bg-white/5 transition ${
                  log.level === "ERROR" ? "bg-discord-danger/5" : ""
                }`}
              >
                <td className="py-2 px-2 text-discord-text-muted whitespace-nowrap text-xs">
                  {new Date(log.created_at).toLocaleString()}
                </td>
                <td className="py-2 px-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${levelColor(log.level)}`}>
                    {log.level}
                  </span>
                </td>
                <td
                  className="py-2 px-2 text-discord-text-secondary max-w-[300px] overflow-hidden text-ellipsis whitespace-nowrap"
                  title={log.message}
                >
                  {log.message}
                </td>
                <td className="py-2 px-2">
                  {log.meta && Object.keys(log.meta).length > 0 && (
                    <details>
                      <summary className="cursor-pointer text-discord-accent text-xs">JSON</summary>
                      <pre className="text-xs mt-1 text-discord-text-secondary whitespace-pre-wrap">
                        {JSON.stringify(log.meta, null, 2)}
                      </pre>
                    </details>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
