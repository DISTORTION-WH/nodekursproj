import React, { useState, useCallback } from "react";
import ChatHeader from "./ChatHeader";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import ChatModals from "./ChatModals";
import ForwardModal from "./ForwardModal";
import { useChat } from "../context/ChatContext";
import { uploadFile } from "../services/api";
import { useI18n } from "../i18n";

interface ChatWindowProps {
  isMobile: boolean;
  onCloseChat: () => void;
}

export default function ChatWindow({ isMobile, onCloseChat }: ChatWindowProps) {
  const { activeChat, typingUsers, chatMembers, forwardingMessage, setForwardingMessage, handleForward, currentUser } = useChat();
  const { t } = useI18n();
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!activeChat) return;
    const file = e.dataTransfer.files[0];
    if (!file) return;
    try {
      await uploadFile(activeChat.id, file);
    } catch (err) {
      console.error("Ошибка загрузки файла:", err);
      alert("Ошибка загрузки файла");
    }
  }, [activeChat]);

  if (!activeChat) return null;

  const typingInChat = typingUsers[activeChat.id] || [];
  const typingNames = typingInChat
    .filter((id) => id !== currentUser?.id)
    .map((id) => chatMembers.find((m) => m.id === id)?.username || t.chat.someone)
    .slice(0, 3);

  return (
    <div
      className={`flex flex-col h-full relative ${isDragging ? "ring-2 ring-discord-accent ring-inset" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none" style={{ background: "rgba(14,15,25,0.85)", backdropFilter: "blur(4px)" }}>
          <div className="px-8 py-6 text-center" style={{ border: "2px dashed rgba(88,101,242,0.6)", background: "rgba(88,101,242,0.08)", borderRadius: "16px" }}>
            <div className="text-4xl mb-2">📁</div>
            <div className="text-discord-text-primary font-semibold text-lg">{t.chat.drop_file}</div>
            <div className="text-discord-text-muted text-sm mt-1">{t.chat.drop_file_hint}</div>
          </div>
        </div>
      )}

      <ChatHeader isMobile={isMobile} onCloseChat={onCloseChat} />
      <MessageList />

      {/* Typing indicator */}
      {typingNames.length > 0 && (
        <div className="px-4 py-1 flex items-center gap-2 shrink-0">
          <div className="flex gap-0.5 items-end">
            <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:0ms]" style={{ background: "linear-gradient(135deg, #5865f2, #eb459e)" }} />
            <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:150ms]" style={{ background: "linear-gradient(135deg, #5865f2, #eb459e)" }} />
            <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:300ms]" style={{ background: "linear-gradient(135deg, #5865f2, #eb459e)" }} />
          </div>
          <span className="text-discord-text-muted text-xs italic">
            {typingNames.join(", ")} {typingNames.length === 1 ? t.chat.typing_one : t.chat.typing_many}
          </span>
        </div>
      )}

      <MessageInput />
      <ChatModals />

      {/* Forward modal */}
      {forwardingMessage && (
        <ForwardModal
          message={forwardingMessage}
          onClose={() => setForwardingMessage(null)}
          onForward={handleForward}
        />
      )}
    </div>
  );
}
