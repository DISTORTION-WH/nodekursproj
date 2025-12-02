import React, { useState } from 'react';
import { broadcastMessage } from '../../services/api';

const BroadcastPanel: React.FC = () => {
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');

  const handleBroadcast = async () => {
    if (!text) return;
    try {
      setStatus('Отправка...');
      await broadcastMessage(text);
      setStatus('Рассылка успешно выполнена!');
      setText('');
    } catch (e) {
      console.error(e);
      setStatus('Ошибка при рассылке');
    }
  };

  return (
    <div className="admin-panel">
      <h3>Системная рассылка</h3>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Введите сообщение для всех пользователей..."
        rows={4}
        style={{ width: '100%', marginBottom: '10px' }}
      />
      <button onClick={handleBroadcast}>Отправить всем</button>
      {status && <p>{status}</p>}
    </div>
  );
};

export default BroadcastPanel;