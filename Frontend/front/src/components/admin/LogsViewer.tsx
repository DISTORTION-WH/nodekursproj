import React, { useState, useEffect } from "react";
import api from "../../services/api";
import { LogEntry } from "../../types";

export default function LogsViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = () => {
    api.get<LogEntry[]>("/admin/logs?limit=50")
      .then((res) => setLogs(res.data))
      .catch((err) => console.error("Ошибка загрузки логов:", err));
  };

  return (
    <div className="bg-[#202225] p-5 rounded-xl mb-5 md:p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl m-0">Последние системные логи (50)</h3>
        <button 
            className="bg-success text-white border-none py-1.5 px-2.5 rounded cursor-pointer font-semibold text-sm hover:opacity-90"
            onClick={fetchLogs}
        >
          🔄 Обновить
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="bg-black/20 font-semibold text-[#b9bbbe] p-3 text-left border-b border-white/10">Время</th>
              <th className="bg-black/20 font-semibold text-[#b9bbbe] p-3 text-left border-b border-white/10">Уровень</th>
              <th className="bg-black/20 font-semibold text-[#b9bbbe] p-3 text-left border-b border-white/10">Сообщение</th>
              <th className="bg-black/20 font-semibold text-[#b9bbbe] p-3 text-left border-b border-white/10">Детали</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => {
                const levelLower = log.level.toLowerCase();
                let rowClass = "";
                if (levelLower === "error") rowClass = "bg-red-500/15";
                else if (levelLower === "warn") rowClass = "bg-yellow-500/15";

                let badgeClass = "bg-gray-500";
                if (levelLower === "error") badgeClass = "bg-danger";
                else if (levelLower === "warn") badgeClass = "bg-yellow-500 text-black";
                else if (levelLower === "info") badgeClass = "bg-accent";

                return (
                  <tr key={log.id} className={`border-b border-white/10 ${rowClass}`}>
                    <td className="p-3 whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                    <td className="p-3">
                      <span className={`${badgeClass} text-white px-1.5 py-0.5 rounded text-xs font-bold uppercase`}>
                        {log.level}
                      </span>
                    </td>
                    <td className="p-3 max-w-[300px] overflow-hidden text-ellipsis" title={log.message}>
                      {log.message}
                    </td>
                    <td className="p-3">
                      {log.meta && Object.keys(log.meta).length > 0 && (
                        <details>
                          <summary className="cursor-pointer text-accent select-none">JSON</summary>
                          <pre className="text-xs text-left mt-1 whitespace-pre-wrap max-h-[200px] overflow-y-auto bg-black/30 p-2 rounded text-gray-300">
                            {JSON.stringify(log.meta, null, 2)}
                          </pre>
                        </details>
                      )}
                    </td>
                  </tr>
                );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}