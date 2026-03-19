import React, { useState, useRef, useEffect, KeyboardEvent, ChangeEvent } from "react";
import EmojiPicker, { Theme, EmojiClickData } from "emoji-picker-react";
import { useChat } from "../context/ChatContext";
import VoiceRecorder from "./VoiceRecorder";
import VideoNoteRecorder from "./VideoNoteRecorder";
import StickerPicker from "./StickerPicker";
import { uploadFile } from "../services/api";
import { useI18n } from "../i18n";

export default function MessageInput() {
  const [newMessage, setNewMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [showVideoNote, setShowVideoNote] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { sendMessage, replyingTo, setReplyingTo, sendTyping, sendStopTyping, activeChat } = useChat();
  const { t } = useI18n();
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

  const handleStickerSelect = (stickerUrl: string) => {
    sendMessage(stickerUrl, replyingTo?.id ?? null);
    setReplyingTo(null);
    setShowStickerPicker(false);
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

      {/* Sticker picker */}
      {showStickerPicker && (
        <div className="absolute bottom-full left-4 mb-2 z-20">
          <StickerPicker
            onSelect={handleStickerSelect}
            onClose={() => setShowStickerPicker(false)}
          />
        </div>
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
          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-150 shrink-0 ${showEmojiPicker ? "text-discord-accent bg-discord-accent/10" : "text-discord-text-muted hover:text-discord-text-primary hover:bg-discord-tertiary"}`}
          onClick={(e) => {
            e.stopPropagation();
            setShowEmojiPicker(!showEmojiPicker);
            setShowVoiceRecorder(false);
            setShowStickerPicker(false);
          }}
          title="Emoji"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
            <line x1="9" y1="9" x2="9.01" y2="9"/>
            <line x1="15" y1="9" x2="15.01" y2="9"/>
          </svg>
        </button>

        {/* File attach button */}
        <button
          type="button"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-discord-text-muted hover:text-discord-text-primary hover:bg-discord-tertiary transition-all duration-150 shrink-0"
          onClick={() => !uploading && fileInputRef.current?.click()}
          title="Прикрепить файл"
          disabled={uploading}
        >
          {uploading ? (
            <span className="inline-block w-4 h-4 border-2 border-discord-text-muted border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
            </svg>
          )}
        </button>

        {/* Voice recorder toggle */}
        <button
          type="button"
          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-150 shrink-0 ${showVoiceRecorder ? "text-discord-danger bg-discord-danger/10" : "text-discord-text-muted hover:text-discord-text-primary hover:bg-discord-tertiary"}`}
          onClick={() => {
            setShowVoiceRecorder(!showVoiceRecorder);
            setShowVideoNote(false);
            setShowEmojiPicker(false);
          }}
          title="Голосовое сообщение"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
            <path d="M19 10v2a7 7 0 01-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </button>

        {/* Video note toggle */}
        <button
          type="button"
          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-150 shrink-0 ${showVideoNote ? "text-discord-accent bg-discord-accent/10" : "text-discord-text-muted hover:text-discord-text-primary hover:bg-discord-tertiary"}`}
          onClick={() => {
            setShowVideoNote(!showVideoNote);
            setShowVoiceRecorder(false);
            setShowEmojiPicker(false);
            setShowStickerPicker(false);
          }}
          title="Видеосообщение"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7"/>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
          </svg>
        </button>

        {/* Sticker picker toggle */}
        <button
          type="button"
          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-150 shrink-0 ${showStickerPicker ? "text-discord-accent bg-discord-accent/10" : "text-discord-text-muted hover:text-discord-text-primary hover:bg-discord-tertiary"}`}
          onClick={() => {
            setShowStickerPicker(!showStickerPicker);
            setShowEmojiPicker(false);
            setShowVoiceRecorder(false);
            setShowVideoNote(false);
          }}
          title="Стикеры"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2z"/>
            <path d="M8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" fill="currentColor"/>
            <path d="M15.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" fill="currentColor"/>
            <path d="M8 14c.5 1.5 2 3 4 3s3.5-1.5 4-3"/>
          </svg>
        </button>

        <input
          value={newMessage}
          onChange={handleChange}
          placeholder={replyingTo ? `${t.chat.reply_prefix} ${replyingTo.sender_name}...` : t.chat.message_placeholder}
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
