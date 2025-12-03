import React, { useState, useEffect, useCallback } from 'react';
import { 
    searchUsers, getAllUsers, banUser, unbanUser, warnUser, 
    getReports, dismissReport, deleteMessageByMod 
} from '../services/api';
import { User, Report } from '../types';
import { getImageUrl } from "../utils/imageUrl";
import './AdminPage.css';

const ModeratorPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'reports'>('users');

  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  
  const [reports, setReports] = useState<Report[]>([]);

  const [warningUser, setWarningUser] = useState<User | null>(null);
  const [warnReason, setWarnReason] = useState('');
  const [linkedReportId, setLinkedReportId] = useState<number | null>(null);

  const loadUsers = useCallback(async () => {
      try {
          const res = await getAllUsers();
          setUsers(res.data);
      } catch (e) { console.error(e); }
  }, []);

  const loadReports = useCallback(async () => {
      try {
          const res = await getReports();
          setReports(res.data);
      } catch (e) { console.error(e); }
  }, []);

  const handleCancelWarn = useCallback(() => {
      setWarningUser(null);
      setLinkedReportId(null);
      setWarnReason('');
  }, []);

  useEffect(() => {
    if (activeTab === 'users') {
        if (!query) loadUsers();
    } else {
        loadReports();
    }
    handleCancelWarn();
  }, [activeTab, query, loadUsers, loadReports, handleCancelWarn]);

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
  }, [query, activeTab, loadUsers]);


  const refreshCurrentTab = () => {
      if (activeTab === 'users') {
          if (query.trim()) {
              searchUsers(query).then(res => setUsers(res.data)).catch(console.error);
          } else {
              loadUsers();
          }
      }
      else loadReports();
  };

  const handleBan = async (user: User) => {
    if (!window.confirm(`Заблокировать пользователя ${user.username}?`)) return;
    try {
      await banUser(user.id);
      refreshCurrentTab();
    } catch (e) { alert('Ошибка блокировки'); }
  };

  const handleUnban = async (user: User) => {
    try {
      await unbanUser(user.id);
      refreshCurrentTab();
    } catch (e) { alert('Ошибка разблокировки'); }
  };

  const handleStartWarn = (user: User, reportId: number | null = null) => {
    setWarningUser(user);
    setLinkedReportId(reportId);
    setWarnReason('');
    setTimeout(() => {
        const formElement = document.getElementById('warn-form');
        if (formElement) formElement.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSubmitWarn = async () => {
    if (!warningUser || !warnReason) return;
    try {
      await warnUser(warningUser.id, warnReason);
      alert(`Предупреждение отправлено ${warningUser.username}`);
      if (linkedReportId) {
          await dismissReport(linkedReportId);
      }
      handleCancelWarn();
      refreshCurrentTab();
    } catch (e) { alert('Ошибка отправки'); }
  };

  const handleDismissReport = async (reportId: number) => {
      try {
          await dismissReport(reportId);
          setReports(prev => prev.filter(r => r.id !== reportId));
      } catch (e) { alert('Ошибка'); }
  };

  const handleDeleteMessage = async (messageId: number, reportId: number) => {
      if (!window.confirm("Удалить это сообщение навсегда?")) return;
      try {
          await deleteMessageByMod(messageId, reportId);
          setReports(prev => prev.filter(r => r.id !== reportId));
      } catch (e) { alert('Ошибка удаления'); }
  };


  const renderWarningForm = () => {
      if (!warningUser) return null;
      return (
        <div id="warn-form" className="edit-form">
            <h4>Выдать предупреждение: {warningUser.username}</h4>
            <textarea
                rows={3}
                placeholder="Укажите причину предупреждения..."
                value={warnReason}
                onChange={e => setWarnReason(e.target.value)}
                style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '6px',
                    border: 'none',
                    background: 'rgba(255, 255, 255, 0.1)',
                    color: 'var(--text-main)',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    marginBottom: '10px'
                }}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
                <button className="admin-btn save" onClick={handleSubmitWarn}>
                    📤 Отправить
                </button>
                <button className="admin-btn cancel" onClick={handleCancelWarn}>
                    ❌ Отмена
                </button>
            </div>
        </div>
      );
  };

  const renderUsersTab = () => (
      <div className="admin-section">
          <h3 className="admin-subtitle">Пользователи</h3>
          <input 
              type="text" 
              placeholder="Поиск по имени или email..." 
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
                            onClick={() => handleStartWarn(user)}
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
          {renderWarningForm()}
      </div>
  );

  const renderReportsTab = () => (
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
                                          onClick={() => handleStartWarn({id: rep.sender_id, username: rep.sender_name} as User, rep.id)}
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
          {renderWarningForm()}
      </div>
  );

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
        {activeTab === 'users' ? renderUsersTab() : renderReportsTab()}
      </div>
    </div>
  );
};

export default ModeratorPage;