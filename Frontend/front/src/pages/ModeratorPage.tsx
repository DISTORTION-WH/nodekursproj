import React, { useState, useEffect } from 'react';
import { 
    searchUsers, getAllUsers, banUser, unbanUser, warnUser, 
    getReports, dismissReport, deleteMessageByMod 
} from '../services/api';
import { User, Report } from '../types';
import Navbar from '../components/Navbar';
import './AdminPage.css';

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
      <Navbar />
      <div className="admin-container">
        <h1>Панель Модератора</h1>
        
        <div style={{marginBottom: 20}}>
            <button 
                onClick={() => setActiveTab('users')} 
                style={{padding: '10px 20px', marginRight: 10, background: activeTab === 'users' ? '#646cff' : '#333', color: 'white', border: 'none', cursor: 'pointer'}}
            >
                Пользователи
            </button>
            <button 
                onClick={() => setActiveTab('reports')} 
                style={{padding: '10px 20px', background: activeTab === 'reports' ? '#646cff' : '#333', color: 'white', border: 'none', cursor: 'pointer'}}
            >
                Жалобы ({reports.length})
            </button>
        </div>

        {activeTab === 'users' && (
            <>
                <div className="search-bar">
                    <input 
                        type="text" 
                        placeholder="Поиск пользователей..." 
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        className="user-search-input"
                    />
                </div>

                <table className="users-table">
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
                                src={user.avatar_url || '/default-avatar.png'} 
                                alt={user.username} 
                                style={{width:32, height:32, borderRadius:'50%'}}
                                />
                                <div>
                                    <div>{user.username}</div>
                                    <div style={{fontSize:'0.8em', color:'#aaa'}}>{user.email}</div>
                                </div>
                            </div>
                        </td>
                        <td>{user.roles?.join(', ')}</td>
                        <td>
                            {user.is_banned 
                                ? <span style={{color:'red', fontWeight:'bold'}}>ЗАБАНЕН</span> 
                                : <span style={{color:'lime'}}>АКТИВЕН</span>
                            }
                        </td>
                        <td>
                            <button className="action-btn warn-btn" onClick={() => openWarnModal(user)} style={{marginRight: 5, padding: '5px 10px', background: '#ff9800', border: 'none', color: 'white', borderRadius: 4, cursor: 'pointer'}}>⚠️ Warn</button>
                            {user.is_banned ? (
                                <button className="action-btn unban-btn" onClick={() => handleUnban(user)} style={{padding: '5px 10px', background: '#2196f3', border: 'none', color: 'white', borderRadius: 4, cursor: 'pointer'}}>🔓 Unban</button>
                            ) : (
                                <button className="action-btn ban-btn" onClick={() => handleBan(user)} style={{padding: '5px 10px', background: '#f44336', border: 'none', color: 'white', borderRadius: 4, cursor: 'pointer'}}>🚫 Ban</button>
                            )}
                        </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </>
        )}

        {activeTab === 'reports' && (
            <table className="users-table">
                <thead>
                    <tr>
                        <th>Дата</th>
                        <th>От кого</th>
                        <th>На кого</th>
                        <th>Сообщение / Причина</th>
                        <th>Действия</th>
                    </tr>
                </thead>
                <tbody>
                    {reports.length === 0 && <tr><td colSpan={5} style={{textAlign:'center'}}>Нет активных жалоб</td></tr>}
                    {reports.map(rep => (
                        <tr key={rep.id}>
                            <td>{new Date(rep.created_at).toLocaleString()}</td>
                            <td>{rep.reporter_name}</td>
                            <td style={{color: '#ff9800', fontWeight: 'bold'}}>{rep.sender_name}</td>
                            <td>
                                <div style={{background: '#222', padding: 5, borderRadius: 4, marginBottom: 5, fontStyle:'italic'}}>
                                    "{rep.message_text}"
                                </div>
                                <div style={{color: '#aaa', fontSize: '0.9em'}}>
                                    Причина: {rep.reason}
                                </div>
                            </td>
                            <td>
                                <div style={{display:'flex', flexDirection:'column', gap: 5}}>
                                    <button 
                                        onClick={() => handleDeleteMessage(rep.message_id, rep.id)}
                                        style={{background: '#f44336', border:'none', color:'white', padding: 4, borderRadius: 3, cursor:'pointer'}}
                                    >
                                        🗑 Удалить сообщение
                                    </button>
                                    <button 
                                        onClick={() => openWarnModal({id: rep.sender_id, username: rep.sender_name} as User, rep.id)}
                                        style={{background: '#ff9800', border:'none', color:'white', padding: 4, borderRadius: 3, cursor:'pointer'}}
                                    >
                                        ⚠️ Предупредить
                                    </button>
                                    <button 
                                        onClick={() => handleBan({id: rep.sender_id, username: rep.sender_name} as User)}
                                        style={{background: '#d32f2f', border:'none', color:'white', padding: 4, borderRadius: 3, cursor:'pointer'}}
                                    >
                                        🚫 Забанить
                                    </button>
                                    <button 
                                        onClick={() => handleDismissReport(rep.id)}
                                        style={{background: '#666', border:'none', color:'white', padding: 4, borderRadius: 3, cursor:'pointer'}}
                                    >
                                        ❌ Отклонить
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        )}
      </div>

      {showWarnModal && (
        <div className="modal-overlay" style={{position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center'}}>
            <div className="modal-content" style={{background:'#333', padding:20, borderRadius:8, width:400, color:'white'}}>
                <h3>Предупреждение</h3>
                <p>Кому: <b>{selectedUser?.username}</b></p>
                <textarea 
                    rows={4} 
                    placeholder="Причина предупреждения..."
                    value={warnReason}
                    onChange={e => setWarnReason(e.target.value)}
                    style={{width:'100%', margin:'10px 0', padding:'8px'}}
                />
                <div style={{display:'flex', justifyContent:'flex-end', gap:'10px'}}>
                    <button onClick={() => setShowWarnModal(false)}>Отмена</button>
                    <button onClick={submitWarn} style={{background:'#ff9800', color:'white', border:'none', padding:'5px 10px', borderRadius:4}}>Отправить</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default ModeratorPage;