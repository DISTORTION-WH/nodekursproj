import React, { useEffect, useState, useRef } from "react";
import ReactDOM from "react-dom";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import { User } from "../../types";
import { getImageUrl } from "../../utils/imageUrl";
import { useHoverCard } from "../../context/HoverCardContext";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../i18n";
import { AvatarWithFrame } from "./AvatarFrameShop";
import ProfileBackground from "./ProfileBackground";
import UsernameDisplay from "./UsernameDisplay";

const CARD_W = 280;
const CARD_H = 220;

function calcPosition(rect: DOMRect): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = rect.right + 8;
  let top = rect.top;
  if (left + CARD_W > vw - 8) left = rect.left - CARD_W - 8;
  if (left < 8) left = 8;
  if (top + CARD_H > vh - 8) top = vh - CARD_H - 8;
  if (top < 8) top = 8;
  return { top, left };
}

export default function ProfileHoverCard() {
  const { target, hideCard, showCard } = useHoverCard();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { t } = useI18n();
  const prevUserId = useRef<number | null>(null);

  useEffect(() => {
    if (!target) {
      setUser(null);
      return;
    }
    if (target.userId === prevUserId.current) return;
    prevUserId.current = target.userId;
    setLoading(true);
    api
      .get<User>(`/users/${target.userId}`)
      .then((res) => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, [target]);

  if (!target) return null;

  const pos = calcPosition(target.anchorRect);
  const isMe = currentUser && user && Number(currentUser.id) === Number(user.id);

  const card = (
    <div
      ref={cardRef}
      onMouseEnter={() => {
        showCard(target.userId, target.anchorRect);
      }}
      onMouseLeave={hideCard}
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        width: CARD_W,
        zIndex: 9999,
        pointerEvents: "auto",
      }}
      className="rounded-xl shadow-2xl overflow-hidden bg-discord-secondary border border-white/10 animate-message-pop"
    >
      {/* Banner */}
      <ProfileBackground profileBg={user?.profile_bg} height={64} />

      {/* Avatar overlapping banner */}
      <div className="relative px-3 pb-3">
        <div className="absolute -top-6 left-3">
          <div className="ring-4 ring-discord-secondary rounded-full">
            <AvatarWithFrame
              src={getImageUrl(user?.avatar_url)}
              frame={user?.avatar_frame}
              size={48}
            />
          </div>
        </div>
        <div className="pt-7 flex flex-col min-w-0 mb-2">
          {loading || !user ? (
            <div className="h-4 w-24 bg-discord-input rounded animate-pulse" />
          ) : (
            <UsernameDisplay
              username={user.username}
              color={user.username_color}
              anim={user.username_anim}
              badge={user.profile_badge}
              className="font-bold text-sm text-white truncate"
            />
          )}
          {user && (
            <span className="text-discord-text-muted text-xs truncate">
              {user.role || "USER"}
            </span>
          )}
        </div>

        {user?.bio && (
          <p className="text-discord-text-secondary text-xs mb-2 line-clamp-2">{user.bio}</p>
        )}

        {user?.social_link && (
          <a
            href={user.social_link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-discord-accent text-xs hover:underline mb-2 block truncate"
          >
            {user.social_link.replace(/^https?:\/\//, "")}
          </a>
        )}

        <div className="flex gap-2 mt-1">
          <button
            onClick={() => {
              hideCard();
              navigate(`/profile/${target.userId}`);
            }}
            style={user?.accent_color ? { background: user.accent_color } : undefined}
            className="flex-1 bg-discord-accent hover:bg-discord-accent-hover text-white text-xs font-semibold py-1.5 rounded transition"
          >
            {t.profile.my_profile}
          </button>
          {!isMe && (
            <button
              onClick={async () => {
                hideCard();
                try {
                  const res = await api.post<{ id: number }>("/chats/private", {
                    friendId: target.userId,
                  });
                  if (res.data?.id) {
                    navigate("/", {
                      state: {
                        openChatId: res.data.id,
                        friend: { username: user?.username, avatar_url: user?.avatar_url },
                      },
                    });
                  }
                } catch {
                  // silently ignore
                }
              }}
              className="flex-1 bg-discord-input hover:bg-discord-input-hover text-discord-text-secondary text-xs font-semibold py-1.5 rounded transition"
            >
              {t.profile.start_chat}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(card, document.body);
}
