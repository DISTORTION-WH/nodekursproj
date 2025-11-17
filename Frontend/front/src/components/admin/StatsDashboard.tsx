import React, { useState, useEffect } from "react";
import api from "../../services/api";
import "../../pages/AdminPage.css";
import { AppStats } from "../../types";

export default function StatsDashboard() {
  const [stats, setStats] = useState<AppStats | null>(null);

  useEffect(() => {
    const fetchStats = () => {
      api.get<AppStats>("/admin/stats")
        .then((res) => setStats(res.data))
        .catch((err: any) => console.error("Ошибка загрузки статистики:", err));
    };

    fetchStats();
  }, []);

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