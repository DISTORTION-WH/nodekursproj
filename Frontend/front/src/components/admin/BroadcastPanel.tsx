import React, { useState } from 'react';
import { adminApi } from '../../services/api';

const BroadcastPanel: React.FC = () => {
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSend = async () => {
    if (!message.trim()) return;

    const isConfirmed = window.confirm(
      "ВНИМАНИЕ: Вы собираетесь отправить сообщение ВСЕМ пользователям приложения.\n\nПродолжить?"
    );

    if (!isConfirmed) return;

    setStatus('loading');
    try {
      await adminApi.broadcastMessage(message);
      setStatus('success');
      setMessage('');
      setTimeout(() => setStatus('idle'), 5000);
    } catch (error) {
      console.error("Broadcast error:", error);
      setStatus('error');
    }
  };

  return (
    <div className="broadcast-panel">
      <div className="broadcast-header">
        <h3 className="broadcast-title">
          <span>📢</span> Официальная рассылка
        </h3>
        <p className="broadcast-desc">
          Сообщение будет отправлено в системный чат каждому пользователю от имени Администратора (LumeOfficial).
        </p>
      </div>

      <textarea
        className="broadcast-textarea"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Введите текст новости, обновления или предупреждения..."
        disabled={status === 'loading'}
      />

      <div className="broadcast-footer">
        <div className="broadcast-status">
          {status === 'success' && (
            <span className="status-success">✅ Сообщение успешно отправлено!</span>
          )}
          {status === 'error' && (
            <span className="status-error">❌ Ошибка отправки. Проверьте консоль.</span>
          )}
        </div>

        <button
          className="broadcast-btn"
          onClick={handleSend}
          disabled={status === 'loading' || !message.trim()}
        >
          {status === 'loading' ? 'Отправка...' : 'Отправить всем'}
        </button>
      </div>
    </div>
  );
};

export default BroadcastPanel;