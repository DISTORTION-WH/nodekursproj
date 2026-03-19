import React, { useEffect, useRef, useState, useCallback } from "react";
import { useChat } from "../context/ChatContext";
import { deleteMessage, reportMessage, addReaction, removeReaction } from "../services/api";
import { Message } from "../types";
import LinkPreview from "./LinkPreview";
import { getImageUrl } from "../utils/imageUrl";

// ─── Custom Voice Message Player ─────────────────────────────────────────────

function VoicePlayer({ src, isMine }: { src: string; isMine: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const draggingRef = useRef(false);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const onDuration = () => {
      if (a.duration && isFinite(a.duration)) setDuration(a.duration);
    };
    const onTime = () => {
      if (!draggingRef.current) setCurrent(a.currentTime);
      // Sometimes duration arrives late (e.g. webm streaming)
      if (a.duration && isFinite(a.duration) && a.duration !== duration) setDuration(a.duration);
    };
    const onEnded = () => { setPlaying(false); setCurrent(0); };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    a.addEventListener("loadedmetadata", onDuration);
    a.addEventListener("durationchange", onDuration);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnded);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    return () => {
      a.removeEventListener("loadedmetadata", onDuration);
      a.removeEventListener("durationchange", onDuration);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); } else { a.play().catch(() => {}); }
  };

  const fmt = (s: number) => {
    if (!s || !isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Seek to a position based on mouse/touch X relative to the bar
  const seekFromEvent = (clientX: number) => {
    const bar = barRef.current;
    const a = audioRef.current;
    if (!bar || !a || !duration) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const newTime = pct * duration;
    a.currentTime = newTime;
    setCurrent(newTime);
  };

  // Mouse drag handlers
  const handleBarMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    draggingRef.current = true;
    seekFromEvent(e.clientX);

    const onMove = (ev: MouseEvent) => seekFromEvent(ev.clientX);
    const onUp = () => {
      draggingRef.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "6px 10px", borderRadius: 16, minWidth: 200, maxWidth: 280,
      background: isMine ? "rgba(128,128,128,0.15)" : "var(--color-input)",
    }}>
      <audio ref={audioRef} src={src} preload="auto" />

      {/* Play / Pause button */}
      <button onClick={togglePlay} style={{
        width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
        background: "var(--color-success)",
        border: "none", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 2px 8px rgba(59,165,93,0.4)",
        transition: "transform 0.12s ease",
      }}
        onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.92)")}
        onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        {playing ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff">
            <rect x="5" y="4" width="5" height="16" rx="1" />
            <rect x="14" y="4" width="5" height="16" rx="1" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff">
            <polygon points="6,3 21,12 6,21" />
          </svg>
        )}
      </button>

      {/* Progress bar + time */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
        <div
          ref={barRef}
          onMouseDown={handleBarMouseDown}
          style={{
            height: 6, borderRadius: 3, cursor: "pointer",
            background: "rgba(128,128,128,0.2)", position: "relative",
          }}
        >
          {/* Filled portion */}
          <div style={{
            height: "100%", borderRadius: 3,
            background: "var(--color-accent)",
            width: `${progress}%`,
            transition: draggingRef.current ? "none" : "width 0.1s linear",
            pointerEvents: "none",
          }} />
          {/* Thumb circle */}
          {duration > 0 && (
            <div style={{
              position: "absolute", top: "50%", left: `${progress}%`,
              transform: "translate(-50%, -50%)",
              width: 12, height: 12, borderRadius: "50%",
              background: "var(--color-text-primary)", border: "2px solid var(--color-accent)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
              pointerEvents: "none",
            }} />
          )}
        </div>
        <div style={{
          display: "flex", justifyContent: "space-between",
          fontSize: 10, color: "var(--color-text-muted)", fontVariantNumeric: "tabular-nums",
          userSelect: "none",
        }}>
          <span>{fmt(currentTime)}</span>
          <span>{fmt(duration)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Circular Video Note Player (Telegram-style) ─────────────────────────────

function VideoNotePlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => {
      if (v.duration && isFinite(v.duration)) {
        setProgress(v.currentTime / v.duration);
        setDuration(v.duration);
      }
    };
    const onEnded = () => { setPlaying(false); setProgress(0); };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onMeta = () => {
      if (v.duration && isFinite(v.duration)) setDuration(v.duration);
    };
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("ended", onEnded);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("loadedmetadata", onMeta);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("ended", onEnded);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("loadedmetadata", onMeta);
    };
  }, []);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) v.pause();
    else v.play().catch(() => {});
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMuted((m) => !m);
    if (videoRef.current) videoRef.current.muted = !muted;
  };

  const circumference = 2 * Math.PI * 62;
  const fmt = (s: number) => {
    if (!s || !isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  const currentTime = videoRef.current?.currentTime ?? 0;

  return (
    <div
      onClick={togglePlay}
      style={{ position: "relative", width: 240, height: 240, cursor: "pointer", flexShrink: 0 }}
    >
      {/* Circular clip */}
      <div style={{
        width: 240, height: 240, borderRadius: "50%", overflow: "hidden",
        background: "#0a0a14",
      }}>
        <video
          ref={videoRef}
          src={src}
          muted={muted}
          playsInline
          preload="auto"
          style={{
            width: "100%", height: "100%", objectFit: "cover",
          }}
        />
      </div>

      {/* Progress ring */}
      <svg
        width="244" height="244"
        viewBox="0 0 132 132"
        style={{
          position: "absolute", top: -2, left: -2,
          transform: "rotate(-90deg)", pointerEvents: "none",
        }}
      >
        {/* Background ring */}
        <circle cx="66" cy="66" r="62" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
        {/* Progress ring */}
        <circle
          cx="66" cy="66" r="62" fill="none"
          stroke="#5865f2"
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.15s linear" }}
        />
      </svg>

      {/* Play overlay when not playing */}
      {!playing && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.3)",
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: "50%",
            background: "rgba(88,101,242,0.85)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff">
              <polygon points="8,4 21,12 8,20" />
            </svg>
          </div>
        </div>
      )}

      {/* Bottom bar: duration + mute toggle */}
      <div style={{
        position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)",
        display: "flex", alignItems: "center", gap: 8,
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)",
        borderRadius: 999, padding: "3px 10px",
        pointerEvents: "auto",
      }}>
        <span style={{
          fontSize: 11, color: "rgba(255,255,255,0.8)", fontVariantNumeric: "tabular-nums",
          fontWeight: 600,
        }}>
          {playing ? fmt(currentTime) : fmt(duration)}
        </span>
        <button
          onClick={toggleMute}
          style={{
            background: "none", border: "none", cursor: "pointer", padding: 0,
            color: "rgba(255,255,255,0.7)", fontSize: 13, lineHeight: 1,
            display: "flex", alignItems: "center",
          }}
          title={muted ? "Включить звук" : "Выключить звук"}
        >
          {muted ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── File Download Card ──────────────────────────────────────────────────────

function FileCard({ url, isMine }: { url: string; isMine: boolean }) {
  const name = getFileName(url);
  const ext = getFileExtension(url);
  const icon = getFileIcon(ext);
  const [hovered, setHovered] = useState(false);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      download
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 12px", borderRadius: 12, minWidth: 180, maxWidth: 300,
        background: hovered
          ? (isMine ? "rgba(128,128,128,0.22)" : "rgba(128,128,128,0.15)")
          : (isMine ? "rgba(128,128,128,0.15)" : "rgba(128,128,128,0.1)"),
        border: "1px solid var(--color-tertiary)",
        textDecoration: "none", color: "inherit",
        transition: "background 0.15s ease",
        cursor: "pointer",
      }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
        background: "rgba(88,101,242,0.2)", border: "1px solid rgba(88,101,242,0.3)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 18,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {name}
        </div>
        <div style={{ fontSize: 11, color: "var(--color-text-muted)", textTransform: "uppercase" }}>
          {ext} — Скачать
        </div>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    </a>
  );
}

const COMMON_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "😡", "🎉", "🔥", "💯", "✅", "👎", "🤔", "😎", "💪", "🙏", "⭐", "🤣", "😊", "😍", "🥳"];

const isStickerUrl = (text: string) =>
  /\/stickers\/\d+\.png(\?.*)?$/i.test(text.trim());

const isImageUrl = (text: string) =>
  /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff)(\?.*)?$/i.test(text.trim());

const isVideoNoteUrl = (text: string) => {
  const t = text.trim();
  // Video notes are named videonote_*.mp4 or videonote_*.webm
  return /^https?:\/\/.+videonote_.*\.(mp4|webm)(\?.*)?$/i.test(t);
};

const isVideoUrl = (text: string) => {
  const t = text.trim();
  if (isVideoNoteUrl(t)) return false; // video notes handled separately
  return /^https?:\/\/.+\.(mp4|mov|avi|mkv)(\?.*)?$/i.test(t);
};

const isAudioUrl = (text: string) => {
  const t = text.trim();
  if (isVideoNoteUrl(t)) return false; // video notes are not audio
  return /^https?:\/\/.+\.(webm|mp3|ogg|wav|m4a|flac|aac)(\?.*)?$/i.test(t);
};

const isFileUrl = (text: string) => {
  const t = text.trim();
  if (!t.startsWith("http")) return false;
  // Any URL ending in a known file extension that's not image/video/audio
  return /^https?:\/\/.+\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|zip|rar|7z|tar|gz|json|xml|apk|exe|dmg|iso)(\?.*)?$/i.test(t);
};

const getFileName = (url: string): string => {
  try {
    const path = new URL(url).pathname;
    const name = path.split("/").pop() || "file";
    // Remove timestamp prefix like "1679328000000_randomhash_"
    return name.replace(/^\d+_[a-zA-Z0-9]+_/, "");
  } catch {
    return "file";
  }
};

const getFileExtension = (url: string): string => {
  const name = getFileName(url);
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return ext;
};

const getFileIcon = (ext: string): string => {
  const icons: Record<string, string> = {
    pdf: "📄", doc: "📝", docx: "📝", txt: "📝",
    xls: "📊", xlsx: "📊", csv: "📊",
    ppt: "📽️", pptx: "📽️",
    zip: "📦", rar: "📦", "7z": "📦", tar: "📦", gz: "📦",
    json: "🔧", xml: "🔧",
    apk: "📱", exe: "💿", dmg: "💿", iso: "💿",
  };
  return icons[ext] || "📎";
};

const extractUrl = (text: string | undefined | null): string | null => {
  if (!text) return null;
  const match = text.match(/https?:\/\/[^\s]+/);
  return match ? match[0] : null;
};

export default function MessageList() {
  const {
    messages,
    currentUser,
    activeChat,
    setReplyingTo,
    loadingMessages,
    loadingMore,
    hasMore,
    loadMoreMessages,
    handleEditMessage,
    handlePin,
    handleUnpin,
    setForwardingMessage,
    pinnedMessages,
    markAsRead,
  } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pickerOpenId, setPickerOpenId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const reactingRef = useRef<Set<string>>(new Set());
  const prevScrollHeight = useRef(0);
  const wasLoadingMore = useRef(false);
  const isFirstLoad = useRef(true);

  // Scroll to bottom on new messages (only when NOT paginating)
  useEffect(() => {
    if (!loadingMore && !wasLoadingMore.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: isFirstLoad.current ? "auto" : "smooth" });
      isFirstLoad.current = false;
    }
  }, [messages.length, loadingMore]);

  useEffect(() => {
    isFirstLoad.current = true;
    wasLoadingMore.current = false;
    setEditingId(null);
    setPickerOpenId(null);
    messagesEndRef.current?.scrollIntoView();
  }, [activeChat]);

  // Restore scroll position after loading more messages
  useEffect(() => {
    if (loadingMore) {
      wasLoadingMore.current = true;
    } else if (wasLoadingMore.current && containerRef.current && prevScrollHeight.current > 0) {
      const newScrollHeight = containerRef.current.scrollHeight;
      containerRef.current.scrollTop = newScrollHeight - prevScrollHeight.current;
      prevScrollHeight.current = 0;
      wasLoadingMore.current = false;
    }
  }, [loadingMore]);

  // Close picker when clicking outside
  useEffect(() => {
    const close = () => setPickerOpenId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  // Cancel edit on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEditingId(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    // Load more when near top
    if (el.scrollTop < 80 && hasMore && !loadingMore) {
      prevScrollHeight.current = el.scrollHeight;
      loadMoreMessages();
    }
    // Mark as read when near bottom
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 50) {
      if (activeChat?.id) markAsRead(activeChat.id);
    }
  }, [hasMore, loadingMore, loadMoreMessages, activeChat, markAsRead]);

  const handleDelete = async (msgId: number) => {
    if (!window.confirm("Удалить сообщение?")) return;
    try {
      await deleteMessage(msgId);
    } catch (e) {
      console.error(e);
      alert("Ошибка удаления");
    }
  };

  const handleReport = async (msgId: number) => {
    const reason = window.prompt("Укажите причину жалобы:");
    if (!reason) return;
    try {
      await reportMessage(msgId, reason);
      alert("Жалоба отправлена модераторам.");
    } catch (e) {
      console.error(e);
      alert("Ошибка отправки жалобы");
    }
  };

  const handleReact = async (msg: Message, emoji: string) => {
    if (!currentUser) return;
    const key = `${msg.id}_${emoji}`;
    if (reactingRef.current.has(key)) return; // prevent duplicate requests
    reactingRef.current.add(key);
    try {
      const hasReacted = msg.reactions?.some(
        (r) => r.emoji === emoji && r.users.includes(currentUser.id)
      );
      if (hasReacted) {
        await removeReaction(msg.id, emoji);
      } else {
        await addReaction(msg.id, emoji);
      }
      setPickerOpenId(null);
    } catch (e) {
      console.error(e);
    } finally {
      reactingRef.current.delete(key);
    }
  };

  const startEdit = (msg: Message) => {
    setEditingId(msg.id);
    setEditText(msg.text);
  };

  const saveEdit = async (msgId: number) => {
    if (savingEdit) return;
    setSavingEdit(true);
    try {
      await handleEditMessage(msgId, editText);
      setEditingId(null);
    } finally {
      setSavingEdit(false);
    }
  };

  if (!activeChat) return null;

  if (loadingMessages) {
    return (
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`flex flex-col max-w-[60%] gap-1 animate-pulse ${i % 2 === 0 ? "self-end items-end" : "self-start items-start"}`}
          >
            <div
              className="h-3 w-16 rounded"
              style={{ background: "linear-gradient(90deg, var(--color-input) 0%, var(--color-input-hover) 50%, var(--color-input) 100%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }}
            />
            <div
              className={`h-9 rounded-xl ${i % 2 === 0 ? "w-48" : "w-36"}`}
              style={{ background: "linear-gradient(90deg, var(--color-input) 0%, var(--color-input-hover) 50%, var(--color-input) 100%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }}
            />
          </div>
        ))}
      </div>
    );
  }

  const isModerator = currentUser?.role === "MODERATOR" || currentUser?.role === "ADMIN";
  const isCreatorOrMod = (chatCreatorId?: number) =>
    isModerator || Number(chatCreatorId) === Number(currentUser?.id);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto p-4 flex flex-col gap-1"
      onScroll={handleScroll}
    >
      {/* Load more spinner */}
      {loadingMore && (
        <div className="flex justify-center py-2">
          <div className="w-5 h-5 rounded-full border-2 border-discord-accent border-t-transparent animate-spin" />
        </div>
      )}

      {messages.map((msg, index) => {
        const isMine = msg.sender_id === currentUser?.id;
        const canDelete = isMine || isModerator;
        const canPin = isCreatorOrMod(activeChat.creator_id);
        const isPinned = pinnedMessages.some((p) => p.id === msg.id);
        const hasReactions = msg.reactions && msg.reactions.length > 0;
        const isVNote = isVideoNoteUrl(msg.text);
        const isSticker = isStickerUrl(msg.text);
        const imageUrl = !isSticker && isImageUrl(msg.text) ? msg.text : null;
        const audioUrl = isAudioUrl(msg.text) ? msg.text : null;
        const isFileMsg = isFileUrl(msg.text);
        const isVideoMsg = isVideoUrl(msg.text);
        const isMediaOrFile = !!(imageUrl || audioUrl || isFileMsg || isVideoMsg || isVNote || isSticker);
        const canEdit = isMine && !isMediaOrFile;
        const isEditing = editingId === msg.id;
        const linkUrl = !imageUrl && !audioUrl && !isFileMsg && !isVideoMsg && !isVNote ? extractUrl(msg.text) : null;

        // Grouping: show avatar only for first message in a series from the same sender
        const isFirstInSeries = index === 0 || messages[index - 1].sender_id !== msg.sender_id;
        const showGroupAvatar = activeChat.is_group && !isMine && isFirstInSeries;

        // Timestamp
        const timeStr = msg.created_at
          ? new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : "";

        return (
          <div
            key={msg.id}
            className={`flex max-w-[75%] group animate-message-pop ${
              isMine ? "self-end" : "self-start"
            }`}
            style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
          >
            {/* Avatar column for group chats (other users' messages) */}
            {activeChat.is_group && !isMine && (
              <div className="w-8 mr-2 flex-shrink-0 flex flex-col items-center justify-start pt-1">
                {showGroupAvatar ? (
                  <img
                    src={getImageUrl(msg.sender?.avatar_url)}
                    alt={msg.sender_name || ""}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8" /> /* spacer to keep alignment */
                )}
              </div>
            )}

            <div className={`flex flex-col ${isMine ? "items-end" : "items-start"} min-w-0 flex-1`}>
            {/* Sender name in group chats */}
            {activeChat.is_group && !isMine && isFirstInSeries && (
              <span className="text-discord-text-muted text-xs mb-0.5 px-1">
                {msg.sender_name}
              </span>
            )}

            {/* Forwarded label */}
            {msg.forwarded_from_id && (
              <div className={`flex items-center gap-1 mb-0.5 px-2 text-xs text-discord-text-muted italic ${isMine ? "self-end" : "self-start"}`}>
                ↪ Пересланное сообщение
              </div>
            )}

            {/* Reply quote above bubble */}
            {msg.reply_to && (
              <div
                className={`flex items-center gap-1 mb-0.5 px-2 py-1 rounded max-w-full ${
                  isMine ? "self-end" : "self-start"
                }`}
              style={{ borderLeft: "3px solid #5865f2", background: "rgba(88,101,242,0.08)" }}
              >
                <span className="text-discord-accent text-xs">↩</span>
                <span className="text-discord-accent text-xs font-semibold mr-1">
                  {msg.reply_to.sender_name}:
                </span>
                <span className="text-discord-text-muted text-xs truncate max-w-[200px]">
                  {(msg.reply_to.text ?? "").length > 60
                    ? (msg.reply_to.text ?? "").slice(0, 60) + "..."
                    : msg.reply_to.text ?? ""}
                </span>
              </div>
            )}

            {/* Message bubble + action buttons */}
            <div
              className={`flex items-center gap-1 ${
                isMine ? "flex-row-reverse" : "flex-row"
              }`}
            >
              {isSticker ? (
                /* Sticker — no bubble, half size */
                <img
                  src={msg.text.trim()}
                  alt="sticker"
                  className="w-[130px] h-[130px] object-contain"
                />
              ) : isVNote ? (
                /* Video note — circular, no bubble */
                <VideoNotePlayer src={msg.text.trim()} />
              ) : isEditing ? (
                /* Inline edit mode */
                <div className="flex flex-col gap-1 min-w-[200px]">
                  <textarea
                    autoFocus
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(msg.id); }
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="bg-discord-input text-discord-text-primary text-sm rounded-xl px-3 py-2 outline-none resize-none border border-discord-accent min-w-[200px]"
                    rows={2}
                  />
                  <div className="flex gap-1 justify-end">
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-xs text-discord-text-muted hover:text-discord-text-primary px-2 py-0.5 rounded hover:bg-discord-input transition"
                    >
                      Отмена
                    </button>
                    <button
                      onClick={() => saveEdit(msg.id)}
                      disabled={savingEdit}
                      className="text-xs bg-discord-accent hover:bg-discord-accent-hover text-white px-2 py-0.5 rounded transition disabled:opacity-50"
                    >
                      {savingEdit ? "..." : "Сохранить"}
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className={`px-3 py-2 rounded-xl text-sm text-discord-text-primary break-words max-w-full ${
                    isMine ? "rounded-br-sm" : "rounded-bl-sm"
                  }`}
                  style={
                    isMine
                      ? { background: "linear-gradient(135deg, var(--color-accent), #7b68ee)", transition: "all 0.15s ease" }
                      : { background: "var(--color-secondary)", transition: "all 0.15s ease" }
                  }
                >
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt="изображение"
                      className="max-w-[260px] max-h-[300px] rounded-lg object-contain cursor-pointer"
                      onClick={() => window.open(imageUrl, "_blank")}
                    />
                  ) : audioUrl ? (
                    <VoicePlayer src={audioUrl} isMine={isMine} />
                  ) : isVideoMsg ? (
                    <video
                      src={msg.text.trim()}
                      controls
                      className="max-w-[320px] max-h-[240px] rounded-lg"
                      style={{ outline: "none" }}
                    />
                  ) : isFileMsg ? (
                    <FileCard url={msg.text.trim()} isMine={isMine} />
                  ) : (
                    <>
                      <span>{msg.text}</span>
                      {msg.edited_at && (
                        <span className="text-xs opacity-60 ml-1">(ред.)</span>
                      )}
                    </>
                  )}
                  {/* Link preview */}
                  {linkUrl && <LinkPreview url={linkUrl} />}
                </div>
              )}

              {/* Action buttons (visible on hover) */}
              {!isEditing && (
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                  {/* Reply */}
                  <button
                    onClick={() => setReplyingTo(msg)}
                    className="text-xs p-1 rounded hover:bg-discord-input text-discord-text-muted hover:text-discord-text-primary transition"
                    title="Ответить"
                  >
                    ↩
                  </button>
                  {/* Edit (own messages) */}
                  {canEdit && (
                    <button
                      onClick={() => startEdit(msg)}
                      className="text-xs p-1 rounded hover:bg-discord-input text-discord-text-muted hover:text-discord-text-primary transition"
                      title="Редактировать"
                    >
                      ✏️
                    </button>
                  )}
                  {/* Forward */}
                  <button
                    onClick={() => setForwardingMessage(msg)}
                    className="text-xs p-1 rounded hover:bg-discord-input text-discord-text-muted hover:text-discord-text-primary transition"
                    title="Переслать"
                  >
                    ↪
                  </button>
                  {/* Pin / Unpin */}
                  {canPin && (
                    <button
                      onClick={() => isPinned ? handleUnpin(msg.id) : handlePin(msg.id)}
                      className={`text-xs p-1 rounded hover:bg-discord-input transition ${isPinned ? "text-discord-warn hover:text-discord-text-primary" : "text-discord-text-muted hover:text-discord-text-primary"}`}
                      title={isPinned ? "Открепить" : "Закрепить"}
                    >
                      📌
                    </button>
                  )}
                  {/* Reaction picker */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPickerOpenId(pickerOpenId === msg.id ? null : msg.id);
                      }}
                      className="text-xs p-1 rounded hover:bg-discord-input text-discord-text-muted hover:text-discord-text-primary transition"
                      title="Реакция"
                    >
                      +😊
                    </button>
                    {pickerOpenId === msg.id && (
                      <div
                        className={`absolute bottom-full mb-1 z-30 bg-discord-secondary rounded-xl p-2 shadow-xl flex flex-wrap gap-1 w-48 ${
                          isMine ? "right-0" : "left-0"
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {COMMON_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => handleReact(msg, emoji)}
                            className="text-lg w-8 h-8 flex items-center justify-center rounded hover:bg-discord-input transition"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Report (not own messages) */}
                  {!isMine && (
                    <button
                      onClick={() => handleReport(msg.id)}
                      className="text-xs p-1 rounded hover:bg-discord-input text-discord-text-muted hover:text-discord-warn transition"
                      title="Пожаловаться"
                    >
                      🚩
                    </button>
                  )}
                  {/* Delete */}
                  {canDelete && (
                    <button
                      onClick={() => handleDelete(msg.id)}
                      className="text-xs p-1 rounded hover:bg-discord-input text-discord-text-muted hover:text-discord-danger transition"
                      title="Удалить"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Reactions bar */}
            {hasReactions && !isEditing && (
              <div className={`flex flex-wrap gap-1 mt-1 ${isMine ? "justify-end" : "justify-start"}`}>
                {msg.reactions!.map((reaction) => {
                  const iReacted = currentUser
                    ? reaction.users.includes(currentUser.id)
                    : false;
                  return (
                    <button
                      key={reaction.emoji}
                      onClick={() => handleReact(msg, reaction.emoji)}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition ${
                        iReacted
                          ? "text-discord-text-primary"
                          : "bg-discord-input hover:bg-discord-input-hover text-discord-text-secondary hover:text-discord-text-primary"
                      }`}
                      style={iReacted ? { background: "rgba(88,101,242,0.25)", border: "1px solid rgba(88,101,242,0.5)" } : undefined}
                      title={iReacted ? "Убрать реакцию" : "Добавить реакцию"}
                    >
                      <span>{reaction.emoji}</span>
                      <span>{reaction.count}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Timestamp */}
            {timeStr && (
              <span className={`text-discord-text-muted text-[10px] mt-0.5 px-1 select-none ${isMine ? "self-end" : "self-start"}`}>
                {timeStr}
              </span>
            )}
            </div>{/* end inner flex-col */}
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
}
