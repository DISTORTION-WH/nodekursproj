import React, { useState, useEffect } from "react";
import api from "../../services/api";
import { AppStats } from "../../types";

export default function StatsDashboard() {
  const [stats, setStats] = useState<AppStats | null>(null);

  useEffect(() => {
    api
      .get<AppStats>("/admin/stats")
      .then((res) => setStats(res.data))
      .catch(console.error);
  }, []);

  if (!stats) {
    return (
      <div className="bg-discord-secondary rounded-xl p-5">
        <p className="text-discord-text-muted text-sm">Загрузка...</p>
      </div>
    );
  }

  const cards = [
    { label: "Пользователей", value: stats.usersCount, accent: "text-discord-accent" },
    { label: "Чатов", value: stats.chatsCount, accent: "text-discord-success" },
    { label: "Сообщений", value: stats.messagesCount, accent: "text-blue-400" },
    { label: "Ошибок в логах", value: stats.logsCount, accent: "text-discord-danger" },
  ];

  return (
    <div className="bg-discord-secondary rounded-xl p-5">
      <h3 className="text-white font-semibold text-base mb-4">Статистика приложения</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-discord-tertiary rounded-xl p-4 flex flex-col gap-1">
            <span className="text-discord-text-muted text-xs uppercase font-semibold">
              {card.label}
            </span>
            <span className={`text-3xl font-bold ${card.accent}`}>{card.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
