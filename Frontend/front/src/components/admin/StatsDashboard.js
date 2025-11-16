import React, { useState, useEffect } from "react";
import axios from "axios";
import "../../pages/AdminPage.css";

export default function StatsDashboard() {
  const [stats, setStats] = useState(null);

  const token = localStorage.getItem("token");
  const authHeaders = token ? { Authorization: "Bearer " + token } : {};

  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line
  }, []);

  const fetchStats = () => {
    axios
      .get("/admin/stats", { headers: authHeaders })
      .then((res) => setStats(res.data))
      .catch((err) => console.error("Ошибка загрузки статистики:", err));
  };

  if (!stats) {
    return (
      <div className="admin-section">
        <h3 className="admin-subtitle">Статистика приложения</h3>
        <p>Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="admin-section">
      <h3 className="admin-subtitle">Статистика приложения</h3>
      <div className="stats-grid">
        <div className="stat-card">
          <h4>Пользователей</h4>
          <p>{stats.usersCount}</p>
        </div>
        <div className="stat-card">
          <h4>Чатов</h4>
          <p>{stats.chatsCount}</p>
        </div>
        <div className="stat-card">
          <h4>Сообщений</h4>
          <p>{stats.messagesCount}</p>
        </div>
        <div className="stat-card error">
          <h4>Ошибок в логах</h4>
          <p>{stats.logsCount}</p>
        </div>
      </div>
    </div>
  );
}
