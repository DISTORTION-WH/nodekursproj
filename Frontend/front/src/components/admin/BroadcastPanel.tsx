import React, { useState } from 'react';
import { adminApi } from '../../services/api'; 

const BroadcastPanel: React.FC = () => {
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [statusText, setStatusText] = useState('');

  const handleSend = async () => {
    if (!message.trim()) return;
    if (!window.confirm("Вы уверены, что хотите отправить это сообщение ВСЕМ пользователям?")) return;

    setStatus('loading');
    try {
      await adminApi.broadcastMessage(message);
      setStatus('success');
      setStatusText('Сообщение успешно отправлено всем пользователям.');
      setMessage('');
    } catch (error) {
      console.error(error);
      setStatus('error');
      setStatusText('Ошибка при отправке рассылки.');
    }
  };

  return (
    <div className="admin-card">
      <h3> Официальная рассылка</h3>
      <p style={{ fontSize: '0.9rem', color: '#ccc', marginBottom: '10px' }}>
        Сообщение будет отправлено всем пользователям от имени LumeOfficial.
      </p>
      
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Введите текст новости или предупреждения..."
        style={{
          width: '100%',
          height: '100px',
          padding: '10px',
          borderRadius: '8px',
          backgroundColor: '#2a2a2a',
          border: '1px solid #444',
          color: 'white',
          marginBottom: '10px',
          resize: 'vertical'
        }}
      />
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        <button 
          onClick={handleSend} 
          disabled={status === 'loading' || !message.trim()}
          className="admin-btn delete-btn" 
          style={{ backgroundColor: '#007bff' }} 
        >
          {status === 'loading' ? 'Отправка...' : 'Отправить всем'}
        </button>

        {status === 'success' && <span style={{ color: '#4caf50' }}>✅ {statusText}</span>}
        {status === 'error' && <span style={{ color: '#f44336' }}>❌ {statusText}</span>}
      </div>
    </div>
  );
};

export default BroadcastPanel;