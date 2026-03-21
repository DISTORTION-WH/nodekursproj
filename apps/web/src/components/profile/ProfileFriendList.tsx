import React, { useState, useEffect } from "react";
import api from "../../services/api";
import { useNavigate } from "react-router-dom";
import { User } from "../../types";
import { getImageUrl } from "../../utils/imageUrl";
import { useI18n } from "../../i18n";
import { useHoverCard } from "../../context/HoverCardContext";

export default function ProfileFriendList() {
  const [friends, setFriends] = useState<User[]>([]);
  const navigate = useNavigate();
  const { t } = useI18n();
  const { showCard, hideCard } = useHoverCard();

  useEffect(() => {
    api
      .get<User[]>("/friends")
      .then((res) => setFriends(res.data || []))
      .catch(() => setFriends([]));
  }, []);

  return (
    <div className="bg-discord-secondary rounded-xl p-6">
      <h3 className="text-white font-semibold text-base mb-3">{t.profile.friends}</h3>

      {friends.length === 0 ? (
        <p className="text-discord-text-muted text-sm">{t.profile.no_friends}</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {friends.map((f) => (
            <div
              key={f.id}
              className="flex flex-col items-center gap-2 p-3 rounded-xl bg-discord-input hover:bg-discord-input-hover cursor-pointer hover:-translate-y-1 transition w-28 shrink-0"
              onClick={() => navigate(`/profile/${f.id}`)}
            >
              <img
                src={getImageUrl(f.avatar_url)}
                alt={f.username}
                className="w-12 h-12 rounded-full object-cover"
                onMouseEnter={(e) => showCard(f.id, (e.currentTarget as HTMLElement).getBoundingClientRect())}
                onMouseLeave={hideCard}
              />
              <span className="text-discord-text-secondary text-xs text-center truncate w-full">
                {f.username}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
