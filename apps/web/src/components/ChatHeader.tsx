import React, { useState, useEffect, useRef, ReactNode } from "react";
import { useChat } from "../context/ChatContext";
import { useCall } from "../context/CallContext";
import { BackArrowIcon, PhoneIcon, VideoIcon } from "./icons";
import { getImageUrl } from "../utils/imageUrl";
import { searchMessagesInChat } from "../services/api";
import { Message } from "../types";

interface ChatHeaderProps {
  isMobile: boolean;
  onCloseChat: () => void;
}

export default function ChatHeader({ isMobile, onCloseChat }: ChatHeaderProps) {
  const [showDeleteOptions, setShowDeleteOptions] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showPinned, setShowPinned] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
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
  } = useChat();
  const { startCall, joinGroupCall } = useCall();

  useEffect(() => {
    if (showSearch) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
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
      alert("Ошибка: Не удалось определить ID пользователя для звонка.");
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
        background: "rgba(30,31,48,0.95)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
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
              placeholder="Поиск по сообщениям..."
              onKeyDown={(e) => { if (e.key === "Escape") setShowSearch(false); }}
              className="w-full bg-discord-input text-discord-text-primary text-sm px-3 py-1.5 rounded-lg outline-none placeholder-discord-text-muted focus:ring-1 focus:ring-discord-accent/60 transition"
            />
            {/* Search results dropdown */}
            {(searchResults.length > 0 || searching || searchError || searchQuery.trim()) && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-discord-secondary border border-white/10 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
                {searching && (
                  <div className="px-3 py-2 text-discord-text-muted text-sm">Поиск...</div>
                )}
                {!searching && searchError && (
                  <div className="px-3 py-2 text-discord-danger text-sm">Ошибка поиска. Попробуйте ещё раз.</div>
                )}
                {!searching && !searchError && searchResults.length === 0 && searchQuery.trim() && (
                  <div className="px-3 py-2 text-discord-text-muted text-sm">Ничего не найдено</div>
                )}
                {searchResults.map((msg) => (
                  <div key={msg.id} className="px-3 py-2 hover:bg-discord-input transition border-b border-white/5 last:border-0">
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
          {/* Search toggle */}
          <button
            onClick={() => {
              setShowSearch(!showSearch);
              setShowPinned(false);
              setShowDeleteOptions(false);
            }}
            className={`p-1.5 rounded hover:bg-discord-input transition text-base ${showSearch ? "text-discord-accent" : "text-discord-text-muted hover:text-discord-text-primary"}`}
            title="Поиск"
          >
            🔍
          </button>

          {/* Pinned messages toggle */}
          {pinnedMessages.length > 0 && (
            <button
              onClick={() => {
                setShowPinned(!showPinned);
                setShowSearch(false);
              }}
              className={`relative p-1.5 rounded hover:bg-discord-input transition text-base ${showPinned ? "text-discord-warn" : "text-discord-text-muted hover:text-discord-text-primary"}`}
              title="Закреплённые сообщения"
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
            title={activeChat.is_group ? "Голосовой звонок (группа)" : "Аудиозвонок"}
          >
            <PhoneIcon />
          </button>
          <button
            onClick={() => handleCall(true)}
            className="text-discord-text-muted hover:text-discord-text-primary transition p-1.5 rounded hover:bg-discord-input"
            title={activeChat.is_group ? "Видеозвонок (группа)" : "Видеозвонок"}
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
                Пригласить
              </button>
)}
              <button
                onClick={openMembersModal}
                className={`${btnBase} bg-discord-input text-discord-text-secondary hover:bg-discord-input-hover hover:text-discord-text-primary`}
              >
                Участники
              </button>
              <button
                onClick={handleLeave}
                className={`${btnBase} text-discord-danger hover:text-white`}
                style={{ background: "rgba(237,66,69,0.12)", borderColor: "rgba(237,66,69,0.3)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(237,66,69,0.85)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "transparent"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(237,66,69,0.12)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(237,66,69,0.3)"; }}
              >
                Выйти
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
              Очистить
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleDelete(false)}
                className={`${btnBase} bg-discord-input text-discord-text-secondary hover:bg-discord-input-hover hover:text-discord-text-primary`}
              >
                У себя
              </button>
              <button
                onClick={() => handleDelete(true)}
                className={`${btnBase} text-discord-danger hover:text-white`}
                style={{ background: "rgba(237,66,69,0.12)", borderColor: "rgba(237,66,69,0.3)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(237,66,69,0.85)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "transparent"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(237,66,69,0.12)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(237,66,69,0.3)"; }}
              >
                У всех
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

      {/* Pinned messages panel */}
      {showPinned && pinnedMessages.length > 0 && (
        <div className="border-t border-white/10 bg-discord-secondary max-h-48 overflow-y-auto">
          <div className="px-4 py-2 flex items-center justify-between">
            <span className="text-discord-text-muted text-xs uppercase font-semibold tracking-wide">
              📌 Закреплённые ({pinnedMessages.length})
            </span>
            <button
              onClick={() => setShowPinned(false)}
              className="text-discord-text-muted hover:text-discord-text-primary text-xs transition"
            >
              ✕
            </button>
          </div>
          {pinnedMessages.map((msg) => (
            <div key={msg.id} className="px-4 py-2 border-t border-white/5 hover:bg-discord-input/40 transition">
              <div className="text-discord-text-muted text-xs mb-0.5">{msg.sender_name}</div>
              <div className="text-discord-text-primary text-sm line-clamp-2">{msg.text}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
