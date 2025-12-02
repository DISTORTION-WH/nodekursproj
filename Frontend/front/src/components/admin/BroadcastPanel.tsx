import React, { useState } from 'react';
import { adminApi } from '../../services/api';

const BroadcastPanel: React.FC = () => {
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSend = async () => {
    if (!message.trim()) return;

    const isConfirmed = window.confirm(
      "Вы уверены, что хотите отправить это сообщение ВСЕМ пользователям?"
    );

    if (!isConfirmed) return;

    setStatus('loading');
    try {
      await adminApi.broadcastMessage(message);
      setStatus('success');
      setMessage('');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (error) {
      console.error("Broadcast error:", error);
      setStatus('error');
    }
  };

  return (
    <div className="max-w-4xl mx-auto mt-6">
      <div className="bg-gray-800 rounded-lg shadow-xl overflow-hidden border border-gray-700">
        
        {/* Заголовок */}
        <div className="bg-gray-900 px-6 py-4 border-b border-gray-700">
          <h3 className="text-xl font-semibold text-white flex items-center gap-2">
            📢 Официальная рассылка
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            Сообщение будет отправлено в системный чат каждому пользователю.
          </p>
        </div>

        {/* Тело формы */}
        <div className="p-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Текст сообщения
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Введите текст новости, предупреждения или обновления..."
            className="w-full h-48 p-4 bg-gray-900 text-gray-100 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all placeholder-gray-500"
            disabled={status === 'loading'}
          />

          {/* Панель действий */}
          <div className="mt-6 flex items-center justify-between">
            <div className="flex-1">
              {status === 'success' && (
                <div className="flex items-center text-green-400 text-sm animate-pulse">
                  <span className="mr-2">✅</span> Сообщение успешно отправлено!
                </div>
              )}
              {status === 'error' && (
                <div className="flex items-center text-red-400 text-sm">
                  <span className="mr-2">❌</span> Ошибка при отправке.
                </div>
              )}
            </div>

            <button
              onClick={handleSend}
              disabled={status === 'loading' || !message.trim()}
              className={`
                px-6 py-2.5 rounded-lg font-medium text-white shadow-lg transition-all duration-200 transform
                ${status === 'loading' || !message.trim() 
                  ? 'bg-gray-600 cursor-not-allowed opacity-50' 
                  : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 hover:scale-105 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800'
                }
              `}
            >
              {status === 'loading' ? 'Отправка...' : 'Отправить всем'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BroadcastPanel;