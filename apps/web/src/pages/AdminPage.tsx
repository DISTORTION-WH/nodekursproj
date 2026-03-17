import React, { useState } from "react";
import UserManagement from "../components/admin/UserManagement";
import ChatManagement from "../components/admin/ChatManagement";
import StatsDashboard from "../components/admin/StatsDashboard";
import LogsViewer from "../components/admin/LogsViewer";
import BroadcastPanel from "../components/admin/BroadcastPanel";

const tabs = [
  { key: "users", label: "Пользователи" },
  { key: "chats", label: "Чаты" },
  { key: "broadcast", label: "Рассылка" },
  { key: "stats", label: "Статистика" },
  { key: "logs", label: "Логи" },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("users");

  const renderTab = () => {
    switch (activeTab) {
      case "users": return <UserManagement />;
      case "chats": return <ChatManagement />;
      case "broadcast": return <BroadcastPanel />;
      case "stats": return <StatsDashboard />;
      case "logs": return <LogsViewer />;
      default: return <UserManagement />;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-discord-bg p-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-white text-2xl font-bold mb-4">Админ-панель</h2>

        <div className="flex gap-2 mb-4 flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded text-sm font-medium transition ${
                activeTab === tab.key
                  ? "bg-discord-accent text-white"
                  : "bg-discord-input text-discord-text-secondary hover:bg-discord-input-hover hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {renderTab()}
      </div>
    </div>
  );
}
