import React, { useState } from "react";
import { useChat } from "../context/ChatContext";
import { Message } from "../types";
import { useI18n } from "../i18n";

interface Props {
  message: Message;
  onClose: () => void;
  onForward: (targetChatId: number, msg: Message) => Promise<void>;
}

export default function ForwardModal({ message, onClose, onForward }: Props) {
  const { allChats } = useChat();
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [forwarding, setForwarding] = useState<number | null>(null);

  const filtered = allChats.filter((c) => {
    const name = c.is_group ? c.name : c.username;
    if (!name) return false;
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const handleForward = async (chatId: number) => {
    if (forwarding !== null) return;
    setForwarding(chatId);
    try {
      await onForward(chatId, message);
    } finally {
      setForwarding(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-discord-secondary rounded-xl w-full max-w-sm shadow-2xl flex flex-col max-h-[70vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-discord-tertiary shrink-0">
          <h3 className="text-discord-text-primary font-semibold text-base">{t.chat.forward_message}</h3>
          <button
            onClick={onClose}
            className="text-discord-text-muted hover:text-discord-text-primary text-xl transition"
          >
            ×
          </button>
        </div>

        {/* Message preview */}
        <div className="px-4 py-2 bg-discord-input/40 border-b border-discord-tertiary shrink-0">
          <div className="text-discord-text-muted text-xs mb-0.5">{message.sender_name}</div>
          <div className="text-discord-text-secondary text-sm line-clamp-2">{message.text}</div>
        </div>

        {/* Search */}
        <div className="px-4 py-2 shrink-0">
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.chat.search_chat}
            className="w-full bg-discord-input text-discord-text-primary text-sm px-3 py-1.5 rounded-lg outline-none placeholder-discord-text-muted"
          />
        </div>

        {/* Chat list */}
        <div className="overflow-y-auto flex-1 px-2 pb-2">
          {filtered.length === 0 && (
            <p className="text-discord-text-muted text-sm text-center py-4">{t.chat.no_chats}</p>
          )}
          {filtered.map((chat) => {
            const name = chat.is_group ? chat.name : chat.username;
            return (
              <div
                key={chat.id}
                className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-discord-input transition cursor-pointer"
                onClick={() => handleForward(chat.id)}
              >
                <div className="w-9 h-9 rounded-full bg-discord-accent flex items-center justify-center text-white text-sm font-bold shrink-0">
                  {name ? name[0].toUpperCase() : "#"}
                </div>
                <span className="text-discord-text-secondary text-sm truncate flex-1">{name}</span>
                {forwarding === chat.id ? (
                  <span className="text-discord-text-muted text-xs">...</span>
                ) : (
                  <button className="text-xs bg-discord-accent/20 hover:bg-discord-accent text-discord-accent hover:text-white px-2 py-0.5 rounded transition shrink-0">
                    {t.chat.voice_send}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
