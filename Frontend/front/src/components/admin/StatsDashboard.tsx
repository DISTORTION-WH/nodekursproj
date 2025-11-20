import React, { useState, useEffect } from "react";
import api from "../../services/api";
import { AppStats } from "../../types";

export default function StatsDashboard() {
  const [stats, setStats] = useState<AppStats | null>(null);

  useEffect(() => {
    api.get<AppStats>("/admin/stats")
      .then((res) => setStats(res.data))
      .catch((err: any) => console.error("Ошибка загрузки статистики:", err));
  }, []);

  if (!stats) {
    return (
      <div className="bg-[#202225] p-5 rounded-xl mb-5">
        <h3 className="text-xl mb-4">Статистика приложения</h3>
        <p>Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="bg-[#202225] p-5 rounded-xl mb-5">
      <h3 className="text-xl mb-4">Статистика приложения</h3>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-5 md:grid-cols-[repeat(auto-fit,minmax(140px,1fr))]">
        {[
            { title: "Пользователей", val: stats.usersCount },
            { title: "Чатов", val: stats.chatsCount },
            { title: "Сообщений", val: stats.messagesCount },
            { title: "Ошибок в логах", val: stats.logsCount, isError: true },
        ].map((item, idx) => (
            <div key={idx} className="bg-white/5 p-6 rounded-xl text-center md:p-5">
              <h4 className="m-0 mb-4 text-[#b9bbbe] uppercase text-sm font-bold">{item.title}</h4>
              <p className={`m-0 text-5xl font-bold leading-none md:text-4xl ${item.isError ? 'text-danger' : 'text-accent'}`}>
                  {item.val}
              </p>
            </div>
        ))}
      </div>
    </div>
  );
}