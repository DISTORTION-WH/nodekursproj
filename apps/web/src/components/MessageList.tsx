import React, { useEffect, useRef, useState, useCallback } from "react";
import { useChat } from "../context/ChatContext";
import { deleteMessage, reportMessage, addReaction, removeReaction } from "../services/api";
import { Message } from "../types";
import LinkPreview from "./LinkPreview";

const COMMON_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "😡", "🎉", "🔥", "💯", "✅", "👎", "🤔", "😎", "💪", "🙏", "⭐", "🤣", "😊", "😍", "🥳"];

const isImageUrl = (text: string) =>
  /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(text.trim());

const isAudioUrl = (text: string) =>
  /^https?:\/\/.+\.(webm|mp3|ogg|wav|m4a)(\?.*)?$/i.test(text.trim());

const extractUrl = (text: string): string | null => {
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
    }
  };

  const startEdit = (msg: Message) => {
    setEditingId(msg.id);
    setEditText(msg.text);
  };

  const saveEdit = async (msgId: number) => {
    await handleEditMessage(msgId, editText);
    setEditingId(null);
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
              style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }}
            />
            <div
              className={`h-9 rounded-xl ${i % 2 === 0 ? "w-48" : "w-36"}`}
              style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }}
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
        const canEdit = isMine;
        const canPin = isCreatorOrMod(activeChat.creator_id);
        const isPinned = pinnedMessages.some((p) => p.id === msg.id);
        const hasReactions = msg.reactions && msg.reactions.length > 0;
        const isEditing = editingId === msg.id;
        const imageUrl = isImageUrl(msg.text) ? msg.text : null;
        const audioUrl = isAudioUrl(msg.text) ? msg.text : null;
        const linkUrl = !imageUrl && !audioUrl ? extractUrl(msg.text) : null;

        return (
          <div
            key={msg.id}
            className={`flex flex-col max-w-[75%] group animate-message-pop ${
              isMine ? "self-end items-end" : "self-start items-start"
            }`}
            style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
          >
            {/* Sender name in group chats */}
            {activeChat.is_group && !isMine && (
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
                  {msg.reply_to.text.length > 60
                    ? msg.reply_to.text.slice(0, 60) + "..."
                    : msg.reply_to.text}
                </span>
              </div>
            )}

            {/* Message bubble + action buttons */}
            <div
              className={`flex items-center gap-1 ${
                isMine ? "flex-row-reverse" : "flex-row"
              }`}
            >
              {isEditing ? (
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
                      className="text-xs text-discord-text-muted hover:text-white px-2 py-0.5 rounded hover:bg-discord-input transition"
                    >
                      Отмена
                    </button>
                    <button
                      onClick={() => saveEdit(msg.id)}
                      className="text-xs bg-discord-accent hover:bg-discord-accent-hover text-white px-2 py-0.5 rounded transition"
                    >
                      Сохранить
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
                      ? { background: "linear-gradient(135deg, #5865f2, #7b68ee)", transition: "all 0.15s ease" }
                      : { background: "rgba(45,47,72,0.9)", transition: "all 0.15s ease" }
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
                    <audio controls className="max-w-[260px]" src={audioUrl} />
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
                    className="text-xs p-1 rounded hover:bg-discord-input text-discord-text-muted hover:text-white transition"
                    title="Ответить"
                  >
                    ↩
                  </button>
                  {/* Edit (own messages) */}
                  {canEdit && (
                    <button
                      onClick={() => startEdit(msg)}
                      className="text-xs p-1 rounded hover:bg-discord-input text-discord-text-muted hover:text-white transition"
                      title="Редактировать"
                    >
                      ✏️
                    </button>
                  )}
                  {/* Forward */}
                  <button
                    onClick={() => setForwardingMessage(msg)}
                    className="text-xs p-1 rounded hover:bg-discord-input text-discord-text-muted hover:text-white transition"
                    title="Переслать"
                  >
                    ↪
                  </button>
                  {/* Pin / Unpin */}
                  {canPin && (
                    <button
                      onClick={() => isPinned ? handleUnpin(msg.id) : handlePin(msg.id)}
                      className={`text-xs p-1 rounded hover:bg-discord-input transition ${isPinned ? "text-discord-warn hover:text-white" : "text-discord-text-muted hover:text-white"}`}
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
                      className="text-xs p-1 rounded hover:bg-discord-input text-discord-text-muted hover:text-white transition"
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
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
}
