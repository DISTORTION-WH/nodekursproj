import React, { useState, useRef, useEffect, KeyboardEvent, ChangeEvent } from "react";
import EmojiPicker, { Theme, EmojiClickData } from "emoji-picker-react";
import { useChat } from "../context/ChatContext";
import VoiceRecorder from "./VoiceRecorder";
import VideoNoteRecorder from "./VideoNoteRecorder";
import { uploadFile } from "../services/api";

export default function MessageInput() {
  const [newMessage, setNewMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [showVideoNote, setShowVideoNote] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { sendMessage, replyingTo, setReplyingTo, sendTyping, sendStopTyping, activeChat } = useChat();
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
    };
  }, []);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim()) return;
    sendStopTyping();
    sendMessage(newMessage, replyingTo?.id ?? null);
    setNewMessage("");
    setShowEmojiPicker(false);
    setReplyingTo(null);
    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
      typingTimeout.current = null;
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    sendTyping();
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      sendStopTyping();
      typingTimeout.current = null;
    }, 2000);
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setNewMessage((prev) => prev + emojiData.emoji);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) handleSend();
    if (e.key === "Escape" && replyingTo) setReplyingTo(null);
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChat?.id) return;
    setUploading(true);
    try {
      await uploadFile(activeChat.id, file);
    } catch (err) {
      console.error("Ошибка загрузки файла:", err);
      alert("Ошибка загрузки файла");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="relative px-4 pb-4 shrink-0">
      {/* Reply preview bar */}
      {replyingTo && (
        <div className="flex items-center gap-2 rounded-t-lg px-3 py-2 mb-0.5" style={{ background: "rgba(88,101,242,0.08)", borderLeft: "3px solid #5865f2" }}>
          <span className="text-discord-accent text-xs">↩</span>
          <div className="flex-1 min-w-0">
            <span className="text-discord-accent text-xs font-semibold mr-1">
              {replyingTo.sender_name}
            </span>
            <span className="text-discord-text-muted text-xs truncate">
              {(replyingTo.text ?? "").length > 80
                ? (replyingTo.text ?? "").slice(0, 80) + "..."
                : replyingTo.text ?? ""}
            </span>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="text-discord-text-muted hover:text-discord-text-primary text-sm transition shrink-0 ml-1"
            title="Отмена"
          >
            ✕
          </button>
        </div>
      )}

      {/* Voice recorder panel */}
      {showVoiceRecorder && activeChat && (
        <VoiceRecorder
          chatId={activeChat.id}
          onClose={() => setShowVoiceRecorder(false)}
        />
      )}

      {/* Video note recorder panel */}
      {showVideoNote && activeChat && (
        <VideoNoteRecorder
          chatId={activeChat.id}
          onClose={() => setShowVideoNote(false)}
        />
      )}

      {showEmojiPicker && (
        <div className="absolute bottom-full left-4 mb-2 w-[350px] z-20">
          <EmojiPicker
            onEmojiClick={onEmojiClick}
            theme={Theme.DARK}
            lazyLoadEmojis={true}
            skinTonesDisabled={true}
          />
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
      />

      <form
        onSubmit={handleSend}
        className={`flex items-center gap-2 px-3 py-2 ${
          replyingTo ? "rounded-b-lg" : "rounded-lg"
        }`}
        style={{ background: "var(--color-input)", border: "1px solid var(--color-tertiary)" }}
      >
        {/* Emoji button */}
        <button
          type="button"
          className="text-xl text-discord-text-muted hover:text-discord-text-primary transition-transform duration-150 shrink-0"
          onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.1)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
          onClick={(e) => {
            e.stopPropagation();
            setShowEmojiPicker(!showEmojiPicker);
            setShowVoiceRecorder(false);
          }}
        >
          😀
        </button>

        {/* File attach button */}
        <button
          type="button"
          className="text-discord-text-muted hover:text-discord-text-primary transition-transform duration-150 shrink-0 text-base leading-none"
          onMouseEnter={(e) => { if (!uploading) e.currentTarget.style.transform = "scale(1.1)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
          onClick={() => !uploading && fileInputRef.current?.click()}
          title="Прикрепить файл"
          disabled={uploading}
        >
          {uploading ? (
            <span className="inline-block w-4 h-4 border-2 border-discord-text-muted border-t-transparent rounded-full animate-spin" />
          ) : "📎"}
        </button>

        {/* Voice recorder toggle */}
        <button
          type="button"
          className={`text-discord-text-muted transition-transform duration-150 shrink-0 text-base leading-none ${showVoiceRecorder ? "text-discord-danger" : "hover:text-discord-text-primary"}`}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.1)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
          onClick={() => {
            setShowVoiceRecorder(!showVoiceRecorder);
            setShowVideoNote(false);
            setShowEmojiPicker(false);
          }}
          title="Голосовое сообщение"
        >
          🎤
        </button>

        {/* Video note toggle */}
        <button
          type="button"
          className={`text-discord-text-muted transition-transform duration-150 shrink-0 text-base leading-none ${showVideoNote ? "text-discord-accent" : "hover:text-discord-text-primary"}`}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.1)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
          onClick={() => {
            setShowVideoNote(!showVideoNote);
            setShowVoiceRecorder(false);
            setShowEmojiPicker(false);
          }}
          title="Видеосообщение"
        >
          🎥
        </button>

        <input
          value={newMessage}
          onChange={handleChange}
          placeholder={replyingTo ? `Ответить ${replyingTo.sender_name}...` : "Написать сообщение..."}
          onKeyDown={handleKeyDown}
          onClick={() => setShowEmojiPicker(false)}
          className="flex-1 bg-transparent text-discord-text-primary text-sm outline-none placeholder-discord-text-muted min-w-0"
        />
        <button
          type="submit"
          className="text-white px-3 py-1.5 rounded transition shrink-0 flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #5865f2, #7b68ee)", boxShadow: "0 2px 8px rgba(88,101,242,0.3)" }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.05)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </form>
    </div>
  );
}
