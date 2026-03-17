import React, { useState } from "react";
import { useChat } from "../context/ChatContext";
import { kickUserFromGroup, setChatMemberRole } from "../services/api";
import { ChatRole, ChatParticipant } from "../types";

function getRoleBadge(member: ChatParticipant, creatorId: number | undefined): { label: string; className: string } | null {
  if (member.id === creatorId) return { label: "👑", className: "text-yellow-400" };
  if (member.chat_role === "moderator") return { label: "🛡️", className: "text-discord-accent" };
  if (member.chat_role === "trusted") return { label: "✅", className: "text-discord-success" };
  return null;
}

export default function ChatModals() {
  const {
    modalView,
    closeModal,
    friendsForInvite,
    chatMembers,
    activeChat,
    currentUser,
    handleInvite,
    handleGetInviteCode,
    setChatMembers,
  } = useChat();

  const [updatingRole, setUpdatingRole] = useState<number | null>(null);

  if (!modalView || !activeChat || !currentUser) return null;

  const isInvite = modalView === "invite";
  const list: ChatParticipant[] = isInvite ? (friendsForInvite as any) : chatMembers;

  const isModerator = currentUser.role === "ADMIN" || currentUser.role === "MODERATOR";
  const isOwner = activeChat.creator_id === currentUser.id;
  const isGlobalAdmin = currentUser.role === "ADMIN";
  const canAssignRoles = isOwner || isGlobalAdmin;

  // Find current user's room role
  const myMember = chatMembers.find((m) => m.id === currentUser.id);
  const myRoomRole = myMember?.chat_role ?? "member";
  const canKick = isOwner || isModerator || myRoomRole === "moderator";

  const onKick = async (userId: number) => {
    if (!window.confirm("Исключить пользователя?")) return;
    try {
      await kickUserFromGroup(activeChat.id, userId);
      setChatMembers((prev) => prev.filter((m) => m.id !== userId));
    } catch (e) {
      console.error(e);
      alert("Не удалось исключить пользователя");
    }
  };

  const onRoleChange = async (memberId: number, newRole: string) => {
    setUpdatingRole(memberId);
    try {
      await setChatMemberRole(activeChat.id, memberId, newRole);
      setChatMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, chat_role: newRole as ChatRole } : m))
      );
    } catch (e) {
      console.error(e);
      alert("Не удалось изменить роль");
    } finally {
      setUpdatingRole(null);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={closeModal}
    >
      <div
        className="bg-discord-secondary rounded-xl p-6 w-96 max-h-[80vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold text-lg">
            {isInvite ? "Пригласить" : "Участники"}
          </h3>
          <button
            onClick={closeModal}
            className="text-discord-text-muted hover:text-white transition text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-1">
          {list.length === 0 && (
            <p className="text-discord-text-muted text-sm text-center py-4">
              {isInvite ? "Все друзья уже в чате" : "Нет участников"}
            </p>
          )}

          {list.map((item) => {
            const badge = !isInvite ? getRoleBadge(item as ChatParticipant, activeChat.creator_id) : null;
            const isThisOwner = item.id === activeChat.creator_id;
            const isMe = item.id === currentUser.id;

            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 py-2 px-1 rounded hover:bg-white/5 transition"
              >
                <span className="text-discord-text-secondary text-sm flex-1 truncate flex items-center gap-1">
                  {item.username}
                  {badge && (
                    <span className={`text-xs ${badge.className}`}>{badge.label}</span>
                  )}
                </span>

                {isInvite ? (
                  <button
                    onClick={() => handleInvite((item as any).id)}
                    className="bg-discord-success hover:bg-discord-success-hover text-white text-xs px-3 py-1 rounded transition shrink-0"
                  >
                    Пригласить
                  </button>
                ) : (
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Role selector — only for non-owner members, visible to canAssignRoles */}
                    {canAssignRoles && !isThisOwner && !isMe && (
                      <select
                        value={(item as ChatParticipant).chat_role ?? "member"}
                        disabled={updatingRole === item.id}
                        onChange={(e) => onRoleChange(item.id, e.target.value)}
                        className="text-xs bg-discord-input text-discord-text-secondary rounded px-1 py-0.5 border border-white/10 focus:outline-none cursor-pointer disabled:opacity-50"
                      >
                        <option value="moderator">🛡️ Модератор</option>
                        <option value="trusted">✅ Доверенный</option>
                        <option value="member">Участник</option>
                      </select>
                    )}

                    {/* Kick button */}
                    {!isMe && !isThisOwner && canKick && (
                      <button
                        onClick={() => onKick(item.id)}
                        className="bg-discord-danger/20 hover:bg-discord-danger text-discord-danger hover:text-white text-xs px-2 py-1 rounded transition"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        {!isInvite && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <button
              onClick={handleGetInviteCode}
              className="w-full bg-discord-input hover:bg-discord-input-hover text-discord-text-secondary hover:text-white text-sm py-2 rounded transition"
            >
              Получить код приглашения
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
