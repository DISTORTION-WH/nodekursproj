import React, { useState, useEffect, useRef, ReactNode } from "react";
import { useChat } from "../context/ChatContext";
import { useCall } from "../context/CallContext";
import { BackArrowIcon, PhoneIcon, VideoIcon } from "./icons";
import { getImageUrl } from "../utils/imageUrl";
import { searchMessagesInChat, getMediaGallery, exportChat, getScheduledMessages, deleteScheduledMessage } from "../services/api";
import { Message, MediaItem, ScheduledMessage } from "../types";
import { useI18n } from "../i18n";

interface ChatHeaderProps {
  isMobile: boolean;
  onCloseChat: () => void;
}

export default function ChatHeader({ isMobile, onCloseChat }: ChatHeaderProps) {
  const [showDeleteOptions, setShowDeleteOptions] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showPinned, setShowPinned] = useState(false);
  const [showMedia, setShowMedia] = useState(false);
  const [showScheduledPanel, setShowScheduledPanel] = useState(false);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [scheduledItems, setScheduledItems] = useState<ScheduledMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const {
    activeChat,
    currentUser,
    openInviteModal,
    openMembersModal,
    handleKick,
    deleteMessages,
    pinnedMessages,
    chatMembers,
    soundEnabled: ctxSound,
    setSoundEnabled: ctxSetSound,
  } = useChat();
  const { startCall, joinGroupCall } = useCall();
  const { t } = useI18n();

  useEffect(() => { setSoundEnabled(ctxSound); }, [ctxSound]);

  const handleToggleMedia = async () => {
    if (!activeChat) return;
    if (!showMedia) {
      try {
        const res = await getMediaGallery(activeChat.id);
        setMediaItems(res.data);
      } catch (e) { console.error(e); }
    }
    setShowMedia(!showMedia);
    setShowPinned(false);
    setShowSearch(false);
    setShowScheduledPanel(false);
  };

  const handleExport = async () => {
    if (!activeChat) return;
    try {
      const res = await exportChat(activeChat.id);
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `chat-${activeChat.id}.json`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error(e); }
  };

  const handleToggleScheduled = async () => {
    if (!activeChat) return;
    if (!showScheduledPanel) {
      try {
        const res = await getScheduledMessages(activeChat.id);
        setScheduledItems(res.data);
      } catch (e) { console.error(e); }
    }
    setShowScheduledPanel(!showScheduledPanel);
    setShowMedia(false);
    setShowPinned(false);
    setShowSearch(false);
  };

  const handleDeleteScheduled = async (msgId: number) => {
    if (!activeChat) return;
    try {
      await deleteScheduledMessage(activeChat.id, msgId);
      setScheduledItems(prev => prev.filter(m => m.id !== msgId));
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (showSearch) {
      const timerId = setTimeout(() => searchInputRef.current?.focus(), 50);
      return () => clearTimeout(timerId);
    } else {
      setSearchQuery("");
      setSearchResults([]);
    }
  }, [showSearch]);

  useEffect(() => {
    if (!searchQuery.trim() || !activeChat) {
      setSearchResults([]);
      setSearchError(false);
      return;
    }
    setSearching(true);
    setSearchError(false);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await searchMessagesInChat(activeChat.id, searchQuery);
        setSearchResults(res.data);
      } catch (e) {
        console.error(e);
        setSearchError(true);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [searchQuery, activeChat]);

  if (!activeChat || !currentUser) return null;

  const handleLeave = () => handleKick(currentUser.id);

  const handleDelete = (isAll: boolean) => {
    deleteMessages(isAll);
    setShowDeleteOptions(false);
  };

  const handleCall = (video: boolean) => {
    if (activeChat.is_group) {
      joinGroupCall(activeChat.id, video);
      return;
    }
    const friend = activeChat.participants?.find((p) => Number(p.id) !== Number(currentUser.id));
    if (!friend?.id) {
      alert(t.common.error);
      return;
    }
    startCall(Number(friend.id), video);
  };

  // Invite gate: owner, global mod/admin, room moderator or trusted can invite
  const isOwner = activeChat.creator_id === currentUser.id;
  const isGlobalMod = currentUser.role === "ADMIN" || currentUser.role === "MODERATOR";
  const myMember = chatMembers.find((m) => m.id === currentUser.id);
  const myRoomRole = myMember?.chat_role ?? "member";
  const canInvite = isOwner || isGlobalMod || myRoomRole === "moderator" || myRoomRole === "trusted";

  const highlight = (text: string, query: string): ReactNode => {
    if (!query.trim()) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-discord-warn/40 text-discord-text-primary rounded-sm">
          {text.slice(idx, idx + query.length)}
        </mark>
        {text.slice(idx + query.length)}
      </>
    );
  };

  const btnBase = "px-3 py-1 rounded text-sm font-medium transition border border-transparent";

  return (
    <div
      className="shrink-0 z-10"
      style={{
        background: "var(--color-secondary)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid var(--color-tertiary)",
      }}
    >
      {/* Main header row */}
      <div className="h-[60px] flex items-center px-4 gap-3">
        {isMobile && (
          <button
            onClick={onCloseChat}
            className="text-discord-text-muted hover:text-discord-text-primary transition mr-1"
          >
            <BackArrowIcon />
          </button>
        )}

        {!activeChat.is_group && (
          <img
            src={getImageUrl(activeChat.avatar_url)}
            alt="avatar"
            className="w-8 h-8 rounded-full object-cover shrink-0"
          />
        )}

        {showSearch ? (
          <div className="flex-1 relative">
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.chat.search_placeholder}
              onKeyDown={(e) => { if (e.key === "Escape") setShowSearch(false); }}
              className="w-full bg-discord-input text-discord-text-primary text-sm px-3 py-1.5 rounded-lg outline-none placeholder-discord-text-muted focus:ring-1 focus:ring-discord-accent/60 transition"
            />
            {/* Search results dropdown */}
            {(searchResults.length > 0 || searching || searchError || searchQuery.trim()) && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-discord-secondary border rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto" style={{ borderColor: "var(--color-tertiary)" }}>
                {searching && (
                  <div className="px-3 py-2 text-discord-text-muted text-sm">{t.common.search}...</div>
                )}
                {!searching && searchError && (
                  <div className="px-3 py-2 text-discord-danger text-sm">{t.chat.search_error}</div>
                )}
                {!searching && !searchError && searchResults.length === 0 && searchQuery.trim() && (
                  <div className="px-3 py-2 text-discord-text-muted text-sm">{t.chat.search_no_results}</div>
                )}
                {searchResults.map((msg) => (
                  <div key={msg.id} className="px-3 py-2 hover:bg-discord-input transition border-b last:border-0" style={{ borderColor: "var(--color-tertiary)" }}>
                    <div className="text-discord-text-muted text-xs mb-0.5">{msg.sender_name}</div>
                    <div className="text-discord-text-primary text-sm line-clamp-2">
                      {highlight(msg.text, searchQuery)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <h2 className="text-discord-text-primary font-semibold text-base truncate flex-1 min-w-0">
            {activeChat.username || activeChat.name}
          </h2>
        )}

        <div className="flex items-center gap-1 shrink-0">
          {/* Sound toggle */}
          <button
            onClick={() => ctxSetSound(!soundEnabled)}
            className={`p-1.5 rounded hover:bg-discord-input transition ${soundEnabled ? "text-discord-success" : "text-discord-text-muted"}`}
            title={soundEnabled ? t.chat.sound_off : t.chat.sound_on}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {soundEnabled ? (
                <>
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <path d="M19.07 4.93a10 10 0 010 14.14"/>
                  <path d="M15.54 8.46a5 5 0 010 7.07"/>
                </>
              ) : (
                <>
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
                </>
              )}
            </svg>
          </button>

          {/* Media gallery */}
          <button
            onClick={handleToggleMedia}
            className={`p-1.5 rounded hover:bg-discord-input transition ${showMedia ? "text-discord-accent" : "text-discord-text-muted hover:text-discord-text-primary"}`}
            title={t.chat.media_gallery}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
            </svg>
          </button>

          {/* Scheduled messages */}
          <button
            onClick={handleToggleScheduled}
            className={`p-1.5 rounded hover:bg-discord-input transition ${showScheduledPanel ? "text-discord-accent" : "text-discord-text-muted hover:text-discord-text-primary"}`}
            title={t.chat.scheduled_messages}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </button>

          {/* Export */}
          <button
            onClick={handleExport}
            className="p-1.5 rounded hover:bg-discord-input transition text-discord-text-muted hover:text-discord-text-primary"
            title={t.chat.export_history}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>

          {/* Search toggle */}
          <button
            onClick={() => {
              setShowSearch(!showSearch);
              setShowPinned(false);
              setShowDeleteOptions(false);
              setShowMedia(false);
              setShowScheduledPanel(false);
            }}
            className={`p-1.5 rounded hover:bg-discord-input transition ${showSearch ? "text-discord-accent" : "text-discord-text-muted hover:text-discord-text-primary"}`}
            title={t.common.search}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7"/>
              <path d="M21 21l-4.35-4.35"/>
            </svg>
          </button>

          {/* Pinned messages toggle */}
          {pinnedMessages.length > 0 && (
            <button
              onClick={() => {
                setShowPinned(!showPinned);
                setShowSearch(false);
              }}
              className={`relative p-1.5 rounded hover:bg-discord-input transition text-base ${showPinned ? "text-discord-warn" : "text-discord-text-muted hover:text-discord-text-primary"}`}
              title={t.chat.pinned_messages}
            >
              📌
              <span className="absolute -top-0.5 -right-0.5 bg-discord-danger text-white text-[9px] rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5 font-bold">
                {pinnedMessages.length}
              </span>
            </button>
          )}

          <button
            onClick={() => handleCall(false)}
            className="text-discord-text-muted hover:text-discord-text-primary transition p-1.5 rounded hover:bg-discord-input"
            title={activeChat.is_group ? t.chat.group_audio_call : t.chat.audio_call}
          >
            <PhoneIcon />
          </button>
          <button
            onClick={() => handleCall(true)}
            className="text-discord-text-muted hover:text-discord-text-primary transition p-1.5 rounded hover:bg-discord-input"
            title={activeChat.is_group ? t.chat.group_video_call : t.chat.video_call}
          >
            <VideoIcon />
          </button>

          {activeChat.is_group ? (
            <>
              {canInvite && (
              <button
                onClick={openInviteModal}
                className={`${btnBase} text-discord-success hover:text-white`}
                style={{ background: "rgba(87,242,135,0.12)", borderColor: "rgba(87,242,135,0.3)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(87,242,135,0.85)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "transparent"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(87,242,135,0.12)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(87,242,135,0.3)"; }}
              >
                {t.chat.invite}
              </button>
)}
              <button
                onClick={openMembersModal}
                className={`${btnBase} bg-discord-input text-discord-text-secondary hover:bg-discord-input-hover hover:text-discord-text-primary`}
              >
                {t.chat.members}
              </button>
              <button
                onClick={handleLeave}
                className={`${btnBase} text-discord-danger hover:text-white`}
                style={{ background: "rgba(237,66,69,0.12)", borderColor: "rgba(237,66,69,0.3)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(237,66,69,0.85)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "transparent"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(237,66,69,0.12)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(237,66,69,0.3)"; }}
              >
                {t.chat.leave_group}
              </button>
            </>
          ) : !showDeleteOptions ? (
            <button
              onClick={() => setShowDeleteOptions(true)}
              className={`${btnBase} text-discord-danger hover:text-white`}
              style={{ background: "rgba(237,66,69,0.12)", borderColor: "rgba(237,66,69,0.3)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(237,66,69,0.85)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "transparent"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(237,66,69,0.12)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(237,66,69,0.3)"; }}
            >
              {t.chat.clear_history}
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleDelete(false)}
                className={`${btnBase} bg-discord-input text-discord-text-secondary hover:bg-discord-input-hover hover:text-discord-text-primary`}
              >
                {t.chat.delete_for_me}
              </button>
              <button
                onClick={() => handleDelete(true)}
                className={`${btnBase} text-discord-danger hover:text-white`}
                style={{ background: "rgba(237,66,69,0.12)", borderColor: "rgba(237,66,69,0.3)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(237,66,69,0.85)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "transparent"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(237,66,69,0.12)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(237,66,69,0.3)"; }}
              >
                {t.chat.delete_for_all}
              </button>
              <button
                onClick={() => setShowDeleteOptions(false)}
                className={`${btnBase} text-discord-text-muted hover:text-discord-text-primary`}
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Media gallery panel */}
      {showMedia && (
        <div className="border-t bg-discord-secondary" style={{ borderColor: "var(--color-tertiary)" }}>
          <div className="px-4 py-2 flex items-center justify-between">
            <span className="text-discord-text-muted text-xs uppercase font-semibold tracking-wide">🖼️ {t.chat.media_gallery}</span>
            <button onClick={() => setShowMedia(false)} className="text-discord-text-muted hover:text-discord-text-primary text-xs transition">✕</button>
          </div>
          {mediaItems.length === 0 ? (
            <div className="px-4 pb-3 text-discord-text-muted text-sm">{t.chat.no_media}</div>
          ) : (
            <div className="px-4 pb-3 grid grid-cols-6 gap-1 max-h-40 overflow-y-auto">
              {mediaItems.map(item => {
                const url = item.text.trim();
                const isImg = /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(url);
                const isVid = /\.(mp4|webm|mov)(\?|$)/i.test(url);
                const isAud = /\.(mp3|webm|ogg|wav|m4a)(\?|$)/i.test(url);
                return (
                  <a key={item.id} href={url} target="_blank" rel="noopener noreferrer" className="aspect-square rounded overflow-hidden bg-discord-input hover:opacity-80 transition flex items-center justify-center">
                    {isImg ? (
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    ) : isVid ? (
                      <span className="text-2xl">🎬</span>
                    ) : isAud ? (
                      <span className="text-2xl">🎵</span>
                    ) : (
                      <span className="text-2xl">📎</span>
                    )}
                  </a>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Scheduled messages panel */}
      {showScheduledPanel && (
        <div className="border-t bg-discord-secondary max-h-48 overflow-y-auto" style={{ borderColor: "var(--color-tertiary)" }}>
          <div className="px-4 py-2 flex items-center justify-between">
            <span className="text-discord-text-muted text-xs uppercase font-semibold tracking-wide">🕐 {t.chat.scheduled_messages}</span>
            <button onClick={() => setShowScheduledPanel(false)} className="text-discord-text-muted hover:text-discord-text-primary text-xs transition">✕</button>
          </div>
          {scheduledItems.length === 0 ? (
            <div className="px-4 pb-3 text-discord-text-muted text-sm">{t.chat.no_scheduled}</div>
          ) : scheduledItems.map(msg => (
            <div key={msg.id} className="px-4 py-2 border-t hover:bg-discord-input/40 transition flex items-start justify-between gap-2" style={{ borderColor: "var(--color-tertiary)" }}>
              <div className="min-w-0">
                <div className="text-discord-text-muted text-xs mb-0.5">🕐 {new Date(msg.send_at).toLocaleString()}</div>
                <div className="text-discord-text-primary text-sm line-clamp-2">{msg.text}</div>
              </div>
              <button onClick={() => handleDeleteScheduled(msg.id)} className="text-discord-danger text-xs shrink-0 hover:opacity-80 transition">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Pinned messages panel */}
      {showPinned && pinnedMessages.length > 0 && (
        <div className="border-t bg-discord-secondary max-h-48 overflow-y-auto" style={{ borderColor: "var(--color-tertiary)" }}>
          <div className="px-4 py-2 flex items-center justify-between">
            <span className="text-discord-text-muted text-xs uppercase font-semibold tracking-wide">
              📌 {t.chat.pinned_messages} ({pinnedMessages.length})
            </span>
            <button
              onClick={() => setShowPinned(false)}
              className="text-discord-text-muted hover:text-discord-text-primary text-xs transition"
            >
              ✕
            </button>
          </div>
          {pinnedMessages.map((msg) => (
            <div key={msg.id} className="px-4 py-2 border-t hover:bg-discord-input/40 transition" style={{ borderColor: "var(--color-tertiary)" }}>
              <div className="text-discord-text-muted text-xs mb-0.5">{msg.sender_name}</div>
              <div className="text-discord-text-primary text-sm line-clamp-2">{msg.text}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
