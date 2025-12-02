import React, { useState, useEffect } from 'react';
import { searchUsers, getAllUsers, banUser, unbanUser, warnUser } from '../services/api';
import { User } from '../types';
import Navbar from '../components/Navbar';
import './AdminPage.css';

const ModeratorPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [warnReason, setWarnReason] = useState('');
  const [showWarnModal, setShowWarnModal] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
      try {
          const res = await getAllUsers();
          setUsers(res.data);
      } catch (e) {
          console.error(e);
      }
  };

  useEffect(() => {
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
  }, [query]);

  const handleBan = async (user: User) => {
    if (!window.confirm(`Заблокировать пользователя ${user.username}?`)) return;
    try {
      await banUser(user.id);
      setUsers(users.map(u => u.id === user.id ? { ...u, is_banned: true } : u));
    } catch (e) { alert('Ошибка блокировки'); }
  };

  const handleUnban = async (user: User) => {
    try {
      await unbanUser(user.id);
      setUsers(users.map(u => u.id === user.id ? { ...u, is_banned: false } : u));
    } catch (e) { alert('Ошибка разблокировки'); }
  };

  const openWarnModal = (user: User) => {
    setSelectedUser(user);
    setWarnReason('');
    setShowWarnModal(true);
  };

  const submitWarn = async () => {
    if (!selectedUser || !warnReason) return;
    try {
      await warnUser(selectedUser.id, warnReason);
      alert(`Предупреждение отправлено ${selectedUser.username}`);
      setShowWarnModal(false);
    } catch (e) { alert('Ошибка отправки'); }
  };

  return (
    <div className="admin-page">
      <Navbar /> {/* Добавлен Navbar */}
      <div className="admin-container">
        <h1>Панель Модератора</h1>
        
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
                          alt={user.username} /* Добавлен alt */
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