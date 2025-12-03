import React, { useState, useEffect } from 'react';
import { 
    searchUsers, getAllUsers, banUser, unbanUser, warnUser, 
    getReports, dismissReport, deleteMessageByMod 
} from '../services/api';
import { User, Report } from '../types';
import { getImageUrl } from "../utils/imageUrl";
import './AdminPage.css';
// Импортируем стили для модальных окон, чтобы они выглядели как везде
import './HomePage.css'; 

const ModeratorPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [warnReason, setWarnReason] = useState('');
  const [showWarnModal, setShowWarnModal] = useState(false);
  const [linkedReportId, setLinkedReportId] = useState<number | null>(null); 

  const [activeTab, setActiveTab] = useState<'users' | 'reports'>('users');
  const [reports, setReports] = useState<Report[]>([]);

  useEffect(() => {
    if (activeTab === 'users') {
        loadUsers();
    } else {
        loadReports();
    }
  }, [activeTab]);

  const loadUsers = async () => {
      try {
          const res = await getAllUsers();
          setUsers(res.data);
      } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (activeTab !== 'users') return;
    const delayDebounceFn = setTimeout(async () => {
      if (query.trim()) {
        try {
          const res = await searchUsers(query);
          setUsers(res.data);
        } catch (e) { console.error(e); }
      } else {
        loadUsers();
      }
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [query, activeTab]);

  const handleBan = async (user: User) => {
    if (!window.confirm(`Заблокировать пользователя ${user.username}?`)) return;
    try {
      await banUser(user.id);
      refreshData();
    } catch (e) { alert('Ошибка блокировки'); }
  };

  const handleUnban = async (user: User) => {
    try {
      await unbanUser(user.id);
      refreshData();
    } catch (e) { alert('Ошибка разблокировки'); }
  };

  const openWarnModal = (user: User, reportId: number | null = null) => {
    setSelectedUser(user);
    setLinkedReportId(reportId);
    setWarnReason('');
    setShowWarnModal(true);
  };

  const submitWarn = async () => {
    if (!selectedUser || !warnReason) return;
    try {
      await warnUser(selectedUser.id, warnReason);
      alert(`Предупреждение отправлено ${selectedUser.username}`);
      if (linkedReportId) {
          await dismissReport(linkedReportId);
      }
      setShowWarnModal(false);
      refreshData();
    } catch (e) { alert('Ошибка отправки'); }
  };

  const loadReports = async () => {
      try {
          const res = await getReports();
          setReports(res.data);
      } catch (e) { console.error(e); }
  };

  const handleDismissReport = async (reportId: number) => {
      try {
          await dismissReport(reportId);
          setReports(reports.filter(r => r.id !== reportId));
      } catch (e) { alert('Ошибка'); }
  };

  const handleDeleteMessage = async (messageId: number, reportId: number) => {
      if (!window.confirm("Удалить это сообщение навсегда?")) return;
      try {
          await deleteMessageByMod(messageId, reportId);
          alert("Сообщение удалено");
          setReports(reports.filter(r => r.id !== reportId));
      } catch (e) { alert('Ошибка удаления'); }
  };

  const refreshData = () => {
      if (activeTab === 'users') loadUsers();
      else loadReports();
  };

  return (
    <div className="admin-page">
      <h2 className="admin-title">Панель Модератора</h2>
      
      <div className="admin-tabs">
        <button 
            className={activeTab === 'users' ? 'active' : ''}
            onClick={() => setActiveTab('users')}
        >
            Пользователи
        </button>
        <button 
            className={activeTab === 'reports' ? 'active' : ''}
            onClick={() => setActiveTab('reports')}
        >
            Жалобы ({reports.length})
        </button>
      </div>

      <div className="admin-content">
        {activeTab === 'users' && (
            <div className="admin-section">
                <h3 className="admin-subtitle">Список пользователей</h3>
                <input 
                    type="text" 
                    placeholder="Поиск (имя или email)..." 
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    className="admin-search"
                />

                <div className="admin-table-wrapper">
                    <table className="admin-table">
                        <thead>
                        <tr>
                            <th>ID</th>
                            <th>Пользователь</th>
                            <th>Роль</th>
                            <th>Статус</th>
                            <th>Действия</th>
                        </tr>
                        </thead>
                        <tbody>
                        {users.map(user => (
                            <tr key={user.id}>
                            <td>{user.id}</td>
                            <td>
                                <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                                    <img 
                                      src={getImageUrl(user.avatar_url)} 
                                      alt={user.username} 
                                      style={{width:32, height:32, borderRadius:'50%', objectFit: 'cover'}}
                                    />
                                    <div>
                                        <div style={{fontWeight: 'bold'}}>{user.username}</div>
                                        <div style={{fontSize:'0.8em', color:'#b9bbbe'}}>{user.email}</div>
                                    </div>
                                </div>
                            </td>
                            <td>{user.roles?.join(', ') || user.role}</td>
                            <td>
                                {user.is_banned 
                                    ? <span style={{color:'var(--danger)', fontWeight:'bold'}}>ЗАБАНЕН</span> 
                                    : <span style={{color:'var(--success)'}}>АКТИВЕН</span>
                                }
                            </td>
                            <td>
                                <button 
                                  className="admin-btn" 
                                  style={{backgroundColor: 'var(--warn)', color: '#000'}}
                                  onClick={() => openWarnModal(user)}
                                  title="Предупредить"
                                >
                                  ⚠️
                                </button>
                                {user.is_banned ? (
                                    <button 
                                      className="admin-btn edit" 
                                      onClick={() => handleUnban(user)}
                                      title="Разбанить"
                                    >
                                      🔓
                                    </button>
                                ) : (
                                    <button 
                                      className="admin-btn delete" 
                                      onClick={() => handleBan(user)}
                                      title="Забанить"
                                    >
                                      🚫
                                    </button>
                                )}
                            </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {activeTab === 'reports' && (
            <div className="admin-section">
                <h3 className="admin-subtitle">Жалобы на сообщения</h3>
                <div className="admin-table-wrapper">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Дата</th>
                                <th>Заявитель</th>
                                <th>Нарушитель</th>
                                <th>Причина / Сообщение</th>
                                <th>Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reports.length === 0 && (
                                <tr>
                                    <td colSpan={5} style={{textAlign:'center', padding: '20px', color: '#aaa'}}>
                                        Нет активных жалоб
                                    </td>
                                </tr>
                            )}
                            {reports.map(rep => (
                                <tr key={rep.id}>
                                    <td style={{fontSize: '0.9em'}}>{new Date(rep.created_at).toLocaleString()}</td>
                                    <td>{rep.reporter_name}</td>
                                    <td style={{color: 'var(--accent)', fontWeight: 'bold'}}>{rep.sender_name}</td>
                                    <td style={{maxWidth: '300px'}}>
                                        <div style={{background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '4px', marginBottom: '4px', fontStyle:'italic', fontSize: '0.9em'}}>
                                            "{rep.message_text}"
                                        </div>
                                        <div style={{color: '#b9bbbe', fontSize: '0.85em'}}>
                                            <strong>Причина:</strong> {rep.reason}
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{display:'flex', gap: '5px', flexWrap: 'wrap'}}>
                                            <button 
                                                className="admin-btn delete"
                                                onClick={() => handleDeleteMessage(rep.message_id, rep.id)}
                                                title="Удалить сообщение"
                                            >
                                                🗑 Msg
                                            </button>
                                            <button 
                                                className="admin-btn"
                                                style={{backgroundColor: 'var(--warn)', color: '#000'}}
                                                onClick={() => openWarnModal({id: rep.sender_id, username: rep.sender_name} as User, rep.id)}
                                                title="Предупредить автора"
                                            >
                                                ⚠️ Warn
                                            </button>
                                            <button 
                                                className="admin-btn delete"
                                                style={{backgroundColor: '#c0392b'}}
                                                onClick={() => handleBan({id: rep.sender_id, username: rep.sender_name} as User)}
                                                title="Забанить автора"
                                            >
                                                🚫 Ban
                                            </button>
                                            <button 
                                                className="admin-btn"
                                                style={{backgroundColor: '#7f8c8d', color: 'white'}}
                                                onClick={() => handleDismissReport(rep.id)}
                                                title="Отклонить жалобу"
                                            >
                                                ❌ Skip
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
      </div>

      {showWarnModal && (
        <div className="modal-backdrop" onClick={() => setShowWarnModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{maxWidth: '400px'}}>
                <div className="modal-header">
                    <h3 className="modal-title">Выдать предупреждение</h3>
                    <button className="modal-close-btn" onClick={() => setShowWarnModal(false)}>×</button>
                </div>
                <div className="modal-body">
                    <p style={{marginBottom: '10px', color: '#dcddde'}}>
                        Пользователь: <strong style={{color: '#fff'}}>{selectedUser?.username}</strong>
                    </p>
                    <textarea 
                        rows={4} 
                        placeholder="Укажите причину..."
                        value={warnReason}
                        onChange={e => setWarnReason(e.target.value)}
                        style={{
                            width:'100%', 
                            padding:'10px', 
                            borderRadius:'4px', 
                            border:'1px solid #202225', 
                            background: '#40444b', 
                            color: 'white',
                            resize: 'vertical',
                            fontSize: '1rem'
                        }}
                    />
                </div>
                <div style={{display:'flex', justifyContent:'flex-end', gap:'10px', marginTop: '20px'}}>
                    <button className="admin-btn cancel" onClick={() => setShowWarnModal(false)}>Отмена</button>
                    <button className="admin-btn save" onClick={submitWarn}>Отправить</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default ModeratorPage;