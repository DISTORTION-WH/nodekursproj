import React, { useState, useRef, useEffect, KeyboardEvent, ChangeEvent } from "react";
import EmojiPicker, { Theme, EmojiClickData } from "emoji-picker-react";
import { useChat } from "../context/ChatContext";
import VoiceRecorder from "./VoiceRecorder";
import VideoNoteRecorder from "./VideoNoteRecorder";
import { uploadFile, createPoll, createScheduledMessage } from "../services/api";
import { useI18n } from "../i18n";

const STICKER_COUNT = 27;
const API_BASE = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/$/, "");
const stickerUrls: string[] = Array.from({ length: STICKER_COUNT }, (_, i) => `${API_BASE}/stickers/${i + 1}.png`);

export default function MessageInput() {
  const [newMessage, setNewMessage] = useState("");
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [mediaTab, setMediaTab] = useState<"emoji" | "stickers">("emoji");
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [showVideoNote, setShowVideoNote] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Ephemeral / scheduled / poll panels
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [showScheduled, setShowScheduled] = useState(false);
  const [scheduledTime, setScheduledTime] = useState("");
  const [ephemeralSecs, setEphemeralSecs] = useState<number | null>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const { sendMessage, replyingTo, setReplyingTo, sendTyping, sendStopTyping, activeChat } = useChat();
  const { t } = useI18n();
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
    };
  }, []);

  // Close picker on outside click
  useEffect(() => {
    if (!showMediaPicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowMediaPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMediaPicker]);

  useEffect(() => {
    if (!showMoreMenu) return;
    const handler = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMoreMenu]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !activeChat?.id) return;
    sendStopTyping();

    if (showScheduled && scheduledTime) {
      // Send as scheduled message
      try {
        await createScheduledMessage(activeChat.id, newMessage, scheduledTime);
        setScheduledTime("");
        setShowScheduled(false);
      } catch (err) {
        console.error(err);
      }
    } else {
      sendMessage(newMessage, replyingTo?.id ?? null, ephemeralSecs);
    }

    setNewMessage("");
    setShowMediaPicker(false);
    setReplyingTo(null);
    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
      typingTimeout.current = null;
    }
  };

  const handleCreatePoll = async () => {
    if (!activeChat?.id || !pollQuestion.trim()) return;
    const opts = pollOptions.filter(o => o.trim());
    if (opts.length < 2) return;
    try {
      await createPoll(activeChat.id, pollQuestion.trim(), opts);
      setPollQuestion("");
      setPollOptions(["", ""]);
      setShowPollCreator(false);
    } catch (err) {
      console.error(err);
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
    setShowMediaPicker(false);
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChat?.id) return;
    setUploading(true);
    try {
      await uploadFile(activeChat.id, file);
    } catch (err) {
      console.error("File upload error:", err);
      alert(t.chat.file_upload_error);
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
            title={t.chat.cancel}
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

      {/* Combined emoji + sticker picker */}
      {showMediaPicker && (
        <div
          ref={pickerRef}
          className="absolute bottom-full left-4 mb-2 z-20 rounded-xl shadow-2xl overflow-hidden"
          style={{
            background: "var(--color-secondary)",
            border: "1px solid var(--color-tertiary)",
            width: 350,
          }}
        >
          {/* Tabs */}
          <div className="flex" style={{ borderBottom: "1px solid var(--color-tertiary)" }}>
            <button
              onClick={() => setMediaTab("emoji")}
              className={`flex-1 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide transition ${
                mediaTab === "emoji"
                  ? "text-discord-accent border-b-2 border-discord-accent"
                  : "text-discord-text-muted hover:text-discord-text-primary"
              }`}
            >
              {t.chat.emojis}
            </button>
            <button
              onClick={() => setMediaTab("stickers")}
              className={`flex-1 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide transition ${
                mediaTab === "stickers"
                  ? "text-discord-accent border-b-2 border-discord-accent"
                  : "text-discord-text-muted hover:text-discord-text-primary"
              }`}
            >
              {t.chat.stickers}
            </button>
          </div>

          {mediaTab === "emoji" ? (
            <EmojiPicker
              onEmojiClick={onEmojiClick}
              theme={Theme.DARK}
              lazyLoadEmojis={true}
              skinTonesDisabled={true}
              width={350}
            />
          ) : (
            <div className="p-2 overflow-y-auto" style={{ maxHeight: 280 }}>
              <div className="grid grid-cols-5 gap-1">
                {stickerUrls.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => handleStickerSelect(url)}
                    className="rounded-lg overflow-hidden hover:bg-discord-input transition p-1 flex items-center justify-center"
                    title={`Sticker ${i + 1}`}
                  >
                    <img
                      src={url}
                      alt={`sticker-${i + 1}`}
                      className="w-12 h-12 object-contain"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Poll creator panel */}
      {showPollCreator && (
        <div className="mb-2 p-3 rounded-xl border" style={{ background: "var(--color-secondary)", borderColor: "var(--color-tertiary)" }}>
          <div className="text-xs font-semibold text-discord-text-muted uppercase tracking-wide mb-2">📊 {t.chat.create_poll}</div>
          <input
            value={pollQuestion}
            onChange={e => setPollQuestion(e.target.value)}
            placeholder={t.chat.poll_question}
            className="w-full bg-discord-input text-discord-text-primary text-sm rounded-lg px-3 py-1.5 outline-none mb-2 placeholder-discord-text-muted"
          />
          {pollOptions.map((opt, i) => (
            <div key={i} className="flex gap-1 mb-1">
              <input
                value={opt}
                onChange={e => { const o = [...pollOptions]; o[i] = e.target.value; setPollOptions(o); }}
                placeholder={`${t.chat.poll_option} ${i + 1}`}
                className="flex-1 bg-discord-input text-discord-text-primary text-sm rounded-lg px-3 py-1.5 outline-none placeholder-discord-text-muted"
              />
              {pollOptions.length > 2 && (
                <button onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))} className="text-discord-danger text-sm px-1">✕</button>
              )}
            </div>
          ))}
          {pollOptions.length < 10 && (
            <button
              onClick={() => setPollOptions([...pollOptions, ""])}
              className="text-discord-accent text-xs mb-2 hover:underline"
            >+ {t.chat.poll_add_option}</button>
          )}
          <div className="flex gap-2 justify-end mt-1">
            <button onClick={() => setShowPollCreator(false)} className="text-xs text-discord-text-muted hover:text-discord-text-primary px-2 py-1 rounded hover:bg-discord-input transition">{t.common.cancel}</button>
            <button
              onClick={handleCreatePoll}
              disabled={!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2}
              className="text-xs bg-discord-accent text-white px-3 py-1 rounded transition hover:bg-discord-accent-hover disabled:opacity-40"
            >{t.common.save}</button>
          </div>
        </div>
      )}

      {/* Scheduled message time picker */}
      {showScheduled && (
        <div className="mb-2 px-3 py-2 rounded-xl border flex items-center gap-2" style={{ background: "rgba(88,101,242,0.08)", borderColor: "rgba(88,101,242,0.3)" }}>
          <span className="text-discord-accent text-xs">🕐 {t.chat.schedule_at}:</span>
          <input
            type="datetime-local"
            value={scheduledTime}
            onChange={e => setScheduledTime(e.target.value)}
            min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
            className="bg-discord-input text-discord-text-primary text-xs rounded px-2 py-1 outline-none border-none"
          />
          <button onClick={() => { setShowScheduled(false); setScheduledTime(""); }} className="text-discord-text-muted text-xs ml-auto hover:text-discord-text-primary">✕</button>
        </div>
      )}

      {/* Ephemeral timer indicator */}
      {ephemeralSecs && (
        <div className="mb-1 px-3 flex items-center gap-2">
          <span className="text-discord-warn text-xs">⌛ {t.chat.ephemeral_label}: {ephemeralSecs >= 3600 ? `${ephemeralSecs/3600}h` : ephemeralSecs >= 60 ? `${ephemeralSecs/60}m` : `${ephemeralSecs}s`}</span>
          <button onClick={() => setEphemeralSecs(null)} className="text-discord-text-muted text-xs hover:text-discord-text-primary">✕</button>
        </div>
      )}

      <form
        onSubmit={handleSend}
        className={`flex items-center gap-2 px-3 py-2 ${
          replyingTo ? "rounded-b-lg" : "rounded-lg"
        }`}
        style={{ background: "var(--color-input)", border: "1px solid var(--color-tertiary)" }}
      >
        {/* Emoji+Sticker combined button */}
        <button
          type="button"
          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-150 shrink-0 ${showMediaPicker ? "text-discord-accent bg-discord-accent/10" : "text-discord-text-muted hover:text-discord-text-primary hover:bg-discord-tertiary"}`}
          onClick={(e) => {
            e.stopPropagation();
            setShowMediaPicker(!showMediaPicker);
            setShowVoiceRecorder(false);
          }}
          title="Emoji & Stickers"
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
          title={t.chat.attach_file}
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
            setShowMediaPicker(false);
          }}
          title={t.chat.voice_message}
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
            setShowMediaPicker(false);
          }}
          title={t.chat.video_message}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7"/>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
          </svg>
        </button>

        {/* More options menu (poll / schedule / ephemeral) */}
        <div className="relative shrink-0" ref={moreMenuRef}>
          <button
            type="button"
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-150 ${showMoreMenu ? "text-discord-accent bg-discord-accent/10" : "text-discord-text-muted hover:text-discord-text-primary hover:bg-discord-tertiary"}`}
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            title={t.chat.more_options}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
            </svg>
          </button>
          {showMoreMenu && (
            <div className="absolute bottom-full left-0 mb-1 w-52 rounded-xl shadow-xl py-1 z-30" style={{ background: "var(--color-secondary)", border: "1px solid var(--color-tertiary)" }}>
              <button
                type="button"
                className="w-full text-left px-4 py-2 text-sm text-discord-text-secondary hover:text-discord-text-primary hover:bg-discord-input transition flex items-center gap-2"
                onClick={() => { setShowPollCreator(!showPollCreator); setShowMoreMenu(false); }}
              >
                📊 {t.chat.create_poll}
              </button>
              <button
                type="button"
                className="w-full text-left px-4 py-2 text-sm text-discord-text-secondary hover:text-discord-text-primary hover:bg-discord-input transition flex items-center gap-2"
                onClick={() => { setShowScheduled(!showScheduled); setShowMoreMenu(false); }}
              >
                🕐 {t.chat.schedule_message}
              </button>
              <div className="px-4 py-2 border-t" style={{ borderColor: "var(--color-tertiary)" }}>
                <div className="text-xs text-discord-text-muted mb-1">⌛ {t.chat.ephemeral_timer}</div>
                <div className="flex gap-1 flex-wrap">
                  {[null, 30, 300, 3600, 86400].map(s => (
                    <button
                      key={String(s)}
                      type="button"
                      onClick={() => { setEphemeralSecs(s); setShowMoreMenu(false); }}
                      className={`text-xs px-2 py-0.5 rounded transition ${ephemeralSecs === s ? "bg-discord-accent text-white" : "bg-discord-input hover:bg-discord-input-hover text-discord-text-secondary"}`}
                    >
                      {s === null ? t.chat.ephemeral_off : s < 60 ? `${s}s` : s < 3600 ? `${s/60}m` : `${s/3600}h`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <input
          value={newMessage}
          onChange={handleChange}
          placeholder={replyingTo ? `${t.chat.reply_prefix} ${replyingTo.sender_name}...` : t.chat.message_placeholder}
          onKeyDown={handleKeyDown}
          onClick={() => setShowMediaPicker(false)}
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
