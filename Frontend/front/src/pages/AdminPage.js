// Frontend/front/src/pages/AdminPage.js
import React, { useState } from "react";
import "./AdminPage.css";
import UserManagement from "../components/admin/UserManagement";
import ChatManagement from "../components/admin/ChatManagement";
import StatsDashboard from "../components/admin/StatsDashboard";
import LogsViewer from "../components/admin/LogsViewer";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("users");

  const renderTab = () => {
    switch (activeTab) {
      case "users":
        return <UserManagement />;
      case "chats":
        return <ChatManagement />;
      case "stats":
        return <StatsDashboard />;
      case "logs":
        return <LogsViewer />;
      default:
        return <UserManagement />;
    }
  };

  return (
    <div className="admin-page">
      <h2 className="admin-title">Админ-панель</h2>

      <div className="admin-tabs">
        <button
          className={activeTab === "users" ? "active" : ""}
          onClick={() => setActiveTab("users")}
        >
          Пользователи
        </button>
        <button
          className={activeTab === "chats" ? "active" : ""}
          onClick={() => setActiveTab("chats")}
        >
          Чаты
        </button>
        <button
          className={activeTab === "stats" ? "active" : ""}
          onClick={() => setActiveTab("stats")}
        >
          Статистика
        </button>
        <button
          className={activeTab === "logs" ? "active" : ""}
          onClick={() => setActiveTab("logs")}
        >
          Логи
        </button>
      </div>

      {/* Рендерим активную вкладку */}
      {renderTab()}
    </div>
  );
}
