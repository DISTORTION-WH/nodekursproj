import React, { useState, useEffect, useCallback } from "react";
import {
  searchUsers, getAllUsers, banUser, unbanUser, warnUser,
  getReports, dismissReport, deleteMessageByMod,
} from "../services/api";
import { User, Report } from "../types";
import { getImageUrl } from "../utils/imageUrl";

const ModeratorPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"users" | "reports">("users");
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [warningUser, setWarningUser] = useState<User | null>(null);
  const [warnReason, setWarnReason] = useState("");
  const [linkedReportId, setLinkedReportId] = useState<number | null>(null);

  const loadUsers = useCallback(async () => {
    try { const res = await getAllUsers(); setUsers(res.data); } catch (e) { console.error(e); }
  }, []);

  const loadReports = useCallback(async () => {
    try { const res = await getReports(); setReports(res.data); } catch (e) { console.error(e); }
  }, []);

  const handleCancelWarn = useCallback(() => {
    setWarningUser(null); setLinkedReportId(null); setWarnReason("");
  }, []);

  useEffect(() => {
    if (activeTab === "users") { if (!query) loadUsers(); } else loadReports();
    handleCancelWarn();
  }, [activeTab, query, loadUsers, loadReports, handleCancelWarn]);

  useEffect(() => {
    if (activeTab !== "users") return;
    const t = setTimeout(async () => {
      if (query.trim()) {
        try { const res = await searchUsers(query); setUsers(res.data); } catch (e) { console.error(e); }
      } else { loadUsers(); }
    }, 500);
    return () => clearTimeout(t);
  }, [query, activeTab, loadUsers]);

  const refresh = () => {
    if (activeTab === "users") {
      if (query.trim()) { searchUsers(query).then(r => setUsers(r.data)).catch(console.error); }
      else { loadUsers(); }
    } else { loadReports(); }
  };

  const handleBan = async (user: User) => {
    if (!window.confirm("Забанить " + user.username + "?")) return;
    try { await banUser(user.id); refresh(); } catch { alert("Ошибка блокировки"); }
  };

  const handleUnban = async (user: User) => {
    try { await unbanUser(user.id); refresh(); } catch { alert("Ошибка разблокировки"); }
  };

  const handleStartWarn = (user: User, rid: number | null = null) => {
    setWarningUser(user); setLinkedReportId(rid); setWarnReason("");
  };

  const handleSubmitWarn = async () => {
    if (!warningUser || !warnReason) return;
    try {
      await warnUser(warningUser.id, warnReason);
      if (linkedReportId) await dismissReport(linkedReportId);
      handleCancelWarn(); refresh();
    } catch { alert("Ошибка отправки"); }
  };

  const handleDismissReport = async (id: number) => {
    try { await dismissReport(id); setReports(p => p.filter(r => r.id !== id)); } catch { alert("Ошибка"); }
  };

  const handleDeleteMessage = async (msgId: number, repId: number) => {
    if (!window.confirm("Удалить сообщение навсегда?")) return;
    try { await deleteMessageByMod(msgId, repId); setReports(p => p.filter(r => r.id !== repId)); } catch { alert("Ошибка удаления"); }
  };

  const ic = "bg-discord-input text-white rounded px-3 py-2 outline-none focus:ring-2 focus:ring-discord-accent placeholder-discord-text-muted text-sm w-full";

  const WarnForm = () => {
    if (!warningUser) return null;
    return (
      <div className="mt-4 bg-discord-tertiary rounded-xl p-4 flex flex-col gap-3">
        <h4 className="text-white text-sm font-semibold">Предупреждение: {warningUser.username}</h4>
        <textarea
          rows={3}
          placeholder="Причина..."
          value={warnReason}
          onChange={e => setWarnReason(e.target.value)}
          className={ic + " resize-y"}
        />
        <div className="flex gap-2">
          <button onClick={handleSubmitWarn} className="bg-discord-success hover:bg-discord-success-hover text-white text-sm px-3 py-1.5 rounded transition">
            Отправить
          </button>
          <button onClick={handleCancelWarn} className="bg-discord-input hover:bg-discord-input-hover text-discord-text-secondary hover:text-white text-sm px-3 py-1.5 rounded transition">
            Отмена
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto bg-discord-bg p-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-white text-2xl font-bold mb-4">Панель Модератора</h2>
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab("users")}
            className={"px-4 py-2 rounded text-sm font-medium transition " + (activeTab === "users" ? "bg-discord-accent text-white" : "bg-discord-input text-discord-text-secondary hover:bg-discord-input-hover hover:text-white")}
          >
            Пользователи
          </button>
          <button
            onClick={() => setActiveTab("reports")}
            className={"px-4 py-2 rounded text-sm font-medium transition " + (activeTab === "reports" ? "bg-discord-accent text-white" : "bg-discord-input text-discord-text-secondary hover:bg-discord-input-hover hover:text-white")}
          >
            {"Жалобы (" + reports.length + ")"}
          </button>
        </div>

        {activeTab === "users" && (
          <div className="bg-discord-secondary rounded-xl p-5">
            <input type="text" placeholder="Поиск..." value={query} onChange={e => setQuery(e.target.value)} className={ic + " mb-4"} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-discord-text-muted text-xs uppercase border-b border-white/10">
                    <th className="text-left py-2 px-2">Пользователь</th>
                    <th className="text-left py-2 px-2">Роль</th>
                    <th className="text-left py-2 px-2">Статус</th>
                    <th className="text-left py-2 px-2">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id} className="border-b border-white/5 hover:bg-white/5 transition">
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <img src={getImageUrl(user.avatar_url)} alt={user.username} className="w-8 h-8 rounded-full object-cover" />
                          <div>
                            <div className="text-white text-sm">{user.username}</div>
                            <div className="text-xs text-discord-text-muted">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-discord-text-secondary">{user.role || "USER"}</td>
                      <td className="py-2 px-2">
                        {user.is_banned
                          ? <span className="text-discord-danger text-xs font-bold">ЗАБАНЕН</span>
                          : <span className="text-discord-success text-xs">АКТИВЕН</span>
                        }
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex gap-1">
                          <button onClick={() => handleStartWarn(user)} className="bg-yellow-500/20 hover:bg-yellow-500 text-yellow-400 hover:text-black text-xs px-2 py-1 rounded">warn</button>
                          {user.is_banned
                            ? <button onClick={() => handleUnban(user)} className="bg-discord-success/20 hover:bg-discord-success text-discord-success hover:text-white text-xs px-2 py-1 rounded">unban</button>
                            : <button onClick={() => handleBan(user)} className="bg-discord-danger/20 hover:bg-discord-danger text-discord-danger hover:text-white text-xs px-2 py-1 rounded">ban</button>
                          }
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <WarnForm />
          </div>
        )}

        {activeTab === "reports" && (
          <div className="bg-discord-secondary rounded-xl p-5">
            {reports.length === 0 ? (
              <p className="text-discord-text-muted text-sm text-center py-8">Нет жалоб</p>
            ) : (
              <div className="flex flex-col gap-3">
                {reports.map(rep => (
                  <div key={rep.id} className="bg-discord-tertiary rounded-xl p-4 flex flex-col gap-2">
                    <div className="flex justify-between text-xs text-discord-text-muted flex-wrap gap-1">
                      <span>{new Date(rep.created_at).toLocaleString()}</span>
                      <span>от {rep.reporter_name} на <span className="text-discord-danger font-bold">{rep.sender_name}</span></span>
                    </div>
                    <div className="bg-discord-secondary rounded p-2 text-sm italic text-discord-text-secondary">"{rep.message_text}"</div>
                    <div className="text-xs text-discord-text-muted">Причина: {rep.reason}</div>
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => handleDeleteMessage(rep.message_id, rep.id)} className="bg-discord-danger/20 hover:bg-discord-danger text-discord-danger hover:text-white text-xs px-2 py-1 rounded">Удалить сообщение</button>
                      <button onClick={() => handleStartWarn({ id: rep.sender_id, username: rep.sender_name } as User, rep.id)} className="bg-yellow-500/20 hover:bg-yellow-500 text-yellow-400 hover:text-black text-xs px-2 py-1 rounded">Warn</button>
                      <button onClick={() => handleBan({ id: rep.sender_id, username: rep.sender_name } as User)} className="bg-discord-danger/20 hover:bg-discord-danger text-discord-danger hover:text-white text-xs px-2 py-1 rounded">Ban</button>
                      <button onClick={() => handleDismissReport(rep.id)} className="bg-white/10 hover:bg-white/20 text-discord-text-secondary hover:text-white text-xs px-2 py-1 rounded">Отклонить</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <WarnForm />
          </div>
        )}
      </div>
    </div>
  );
};

export default ModeratorPage;
