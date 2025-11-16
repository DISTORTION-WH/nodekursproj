import React, { useState, useEffect } from "react";
import axios from "axios";
import "../../pages/AdminPage.css";

export default function LogsViewer() {
  const [logs, setLogs] = useState([]);

  const token = localStorage.getItem("token");
  const authHeaders = token ? { Authorization: "Bearer " + token } : {};

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line
  }, []);

  const fetchLogs = () => {
    axios
      .get("/admin/logs?limit=50", { headers: authHeaders })
      .then((res) => setLogs(res.data))
      .catch((err) => console.error("Ошибка загрузки логов:", err));
  };

  return (
    <div className="admin-section">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 15,
        }}
      >
        <h3 className="admin-subtitle" style={{ marginBottom: 0 }}>
          Последние системные логи (50)
        </h3>
        <button className="admin-btn save" onClick={fetchLogs}>
          🔄 Обновить
        </button>
      </div>

      <div className="admin-table-wrapper">
        <table className="admin-table logs-table">
          <thead>
            <tr>
              <th>Время</th>
              <th>Уровень</th>
              <th>Сообщение</th>
              <th>Детали</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className={`log-row ${log.level.toLowerCase()}`}>
                <td style={{ whiteSpace: "nowrap" }}>
                  {new Date(log.created_at).toLocaleString()}
                </td>
                <td>
                  <span className={`log-badge ${log.level.toLowerCase()}`}>
                    {log.level}
                  </span>
                </td>
                <td
                  style={{
                    maxWidth: "300px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  title={log.message}
                >
                  {log.message}
                </td>
                <td>
                  {log.meta && Object.keys(log.meta).length > 0 && (
                    <details>
                      <summary
                        style={{
                          cursor: "pointer",
                          color: "var(--accent)",
                        }}
                      >
                        JSON
                      </summary>
                      <pre
                        style={{
                          fontSize: "0.75rem",
                          textAlign: "left",
                          marginTop: 5,
                        }}
                      >
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
