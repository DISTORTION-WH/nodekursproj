import React, { useState } from "react";
import UserManagement from "../components/admin/UserManagement";
import ChatManagement from "../components/admin/ChatManagement";
import StatsDashboard from "../components/admin/StatsDashboard";
import LogsViewer from "../components/admin/LogsViewer";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("users");

  const renderTab = () => {
    switch (activeTab) {
      case "users": return <UserManagement />;
      case "chats": return <ChatManagement />;
      case "stats": return <StatsDashboard />;
      case "logs": return <LogsViewer />;
      default: return <UserManagement />;
    }
  };

  const tabBtnBase = "border-none px-5 py-2.5 rounded-lg cursor-pointer font-semibold transition-all duration-200";
  const tabBtnActive = "bg-accent text-white";
  const tabBtnInactive = "bg-bg-block text-text-muted hover:bg-accent hover:text-white";

  return (
    <div className={`
      w-full h-full bg-bg text-text-main font-sans p-5 box-border overflow-y-auto 
      md:p-2.5
      [&_.admin-section]:bg-bg-block [&_.admin-section]:p-5 [&_.admin-section]:rounded-xl [&_.admin-section]:mb-5 [&_.admin-section]:md:p-4
      [&_.admin-title]:text-2xl [&_.admin-title]:font-bold [&_.admin-title]:mb-5
      [&_.admin-subtitle]:text-xl [&_.admin-subtitle]:mb-4
      [&_.admin-search]:p-2.5 [&_.admin-search]:mb-4 [&_.admin-search]:rounded-lg [&_.admin-search]:w-full [&_.admin-search]:max-w-[300px] [&_.admin-search]:bg-white/10 [&_.admin-search]:text-white [&_.admin-search]:outline-none
      [&_.admin-table-wrapper]:overflow-x-auto
      [&_.admin-table]:w-full [&_.admin-table]:border-collapse [&_.admin-table]:mb-4 [&_.admin-table]:min-w-[600px]
      [&_.admin-table_th]:bg-black/20 [&_.admin-table_th]:font-semibold [&_.admin-table_th]:text-text-muted [&_.admin-table_th]:p-3 [&_.admin-table_th]:text-left [&_.admin-table_th]:border-b [&_.admin-table_th]:border-white/10
      [&_.admin-table_td]:p-3 [&_.admin-table_td]:text-left [&_.admin-table_td]:align-top [&_.admin-table_td]:border-b [&_.admin-table_td]:border-white/10
      [&_.admin-btn]:border-none [&_.admin-btn]:py-1.5 [&_.admin-btn]:px-2.5 [&_.admin-btn]:rounded-md [&_.admin-btn]:cursor-pointer [&_.admin-btn]:mr-1.5 [&_.admin-btn]:font-semibold [&_.admin-btn]:text-sm
      [&_.admin-btn.edit]:bg-accent [&_.admin-btn.edit]:text-white [&_.admin-btn.edit:hover]:bg-accent-hover
      [&_.admin-btn.delete]:bg-danger [&_.admin-btn.delete]:text-white [&_.admin-btn.delete:hover]:bg-danger-hover
      [&_.admin-btn.save]:bg-success [&_.admin-btn.save]:text-white
      [&_.admin-btn.cancel]:bg-danger [&_.admin-btn.cancel]:text-white
      [&_.edit-form]:flex [&_.edit-form]:flex-col [&_.edit-form]:gap-2.5 [&_.edit-form]:bg-white/5 [&_.edit-form]:p-4 [&_.edit-form]:rounded-lg [&_.edit-form]:mt-5
      [&_.edit-form_input]:p-2 [&_.edit-form_input]:rounded-md [&_.edit-form_input]:bg-white/10 [&_.edit-form_input]:text-white [&_.edit-form_input]:border-none
      [&_.stats-grid]:grid [&_.stats-grid]:grid-cols-[repeat(auto-fit,minmax(200px,1fr))] [&_.stats-grid]:gap-5 [&_.stats-grid]:md:grid-cols-[repeat(auto-fit,minmax(140px,1fr))]
      [&_.stat-card]:bg-white/5 [&_.stat-card]:p-6 [&_.stat-card]:rounded-xl [&_.stat-card]:text-center [&_.stat-card]:md:p-5
      [&_.stat-card_h4]:m-0 [&_.stat-card_h4]:mb-4 [&_.stat-card_h4]:text-text-muted [&_.stat-card_h4]:uppercase [&_.stat-card_h4]:text-sm [&_.stat-card_h4]:font-semibold
      [&_.stat-card_p]:m-0 [&_.stat-card_p]:text-5xl [&_.stat-card_p]:font-bold [&_.stat-card_p]:text-accent [&_.stat-card_p]:leading-none [&_.stat-card_p]:md:text-4xl
      [&_.logs-table_pre]:whitespace-pre-wrap [&_.logs-table_pre]:max-h-[200px] [&_.logs-table_pre]:overflow-y-auto [&_.logs-table_pre]:bg-black/30 [&_.logs-table_pre]:p-2 [&_.logs-table_pre]:rounded-md [&_.logs-table_pre]:text-gray-200
    `}>
      <h2 className="admin-title">Админ-панель</h2>

      <div className="flex gap-2.5 mb-5 flex-wrap md:gap-1.5">
        <button
          className={`${tabBtnBase} ${activeTab === "users" ? tabBtnActive : tabBtnInactive}`}
          onClick={() => setActiveTab("users")}
        >
          Пользователи
        </button>
        <button
          className={`${tabBtnBase} ${activeTab === "chats" ? tabBtnActive : tabBtnInactive}`}
          onClick={() => setActiveTab("chats")}
        >
          Чаты
        </button>
        <button
          className={`${tabBtnBase} ${activeTab === "stats" ? tabBtnActive : tabBtnInactive}`}
          onClick={() => setActiveTab("stats")}
        >
          Статистика
        </button>
        <button
          className={`${tabBtnBase} ${activeTab === "logs" ? tabBtnActive : tabBtnInactive}`}
          onClick={() => setActiveTab("logs")}
        >
          Логи
        </button>
      </div>

      {renderTab()}
    </div>
  );
}