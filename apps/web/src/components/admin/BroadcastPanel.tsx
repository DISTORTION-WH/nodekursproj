import React, { useState } from "react";
import { broadcastMessage } from "../../services/api";

export default function BroadcastPanel() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  const [isError, setIsError] = useState(false);

  const handleBroadcast = async () => {
    if (!text.trim()) return;
    try {
      setStatus("Отправка...");
      setIsError(false);
      await broadcastMessage(text);
      setStatus("Рассылка успешно выполнена!");
      setText("");
    } catch (e) {
      console.error(e);
      setStatus("Ошибка при рассылке");
      setIsError(true);
    }
  };

  return (
    <div className="bg-discord-secondary rounded-xl p-5">
      <h3 className="text-white font-semibold text-base mb-4">Системная рассылка</h3>
      <p className="text-discord-text-muted text-sm mb-3">
        Сообщение будет отправлено всем пользователям от имени LumeOfficial.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Введите сообщение для всех пользователей..."
        rows={4}
        className="w-full bg-discord-tertiary text-white rounded px-3 py-2 outline-none focus:ring-2 focus:ring-discord-accent placeholder-discord-text-muted text-sm resize-y mb-3"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={handleBroadcast}
          disabled={!text.trim()}
          className="bg-discord-accent hover:bg-discord-accent-hover text-white text-sm font-semibold px-4 py-2 rounded transition disabled:opacity-50"
        >
          Отправить всем
        </button>
        {status && (
          <p className={`text-sm ${isError ? "text-discord-danger" : "text-discord-success"}`}>
            {status}
          </p>
        )}
      </div>
    </div>
  );
}
