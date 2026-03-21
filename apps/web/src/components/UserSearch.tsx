import React, { useState } from "react";
import api from "../services/api";
import { User } from "../types";
import { getImageUrl } from "../utils/imageUrl";
import { useI18n } from "../i18n";
import { useHoverCard } from "../context/HoverCardContext";

interface UserSearchProps {
  onOpenProfile: (id: number) => void;
}

export default function UserSearch({ onOpenProfile }: UserSearchProps) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const { t } = useI18n();
  const { showCard, hideCard } = useHoverCard();

  const handleSearch = () => {
    if (!search.trim()) return;
    api
      .get<User[]>(`/users?search=${encodeURIComponent(search)}`)
      .then((res) => setResults(res.data))
      .catch(console.error);
  };

  const addFriend = (id: number) => {
    api
      .post<{ message: string }>("/friends/request", { friendId: id })
      .then((res) => {
        alert(res.data.message);
        setSearch("");
        setResults([]);
      })
      .catch(console.error);
  };

  return (
    <div className="px-2 mt-auto border-t border-discord-tertiary pt-2 pb-2">
      <div className="flex items-center px-2 py-2">
        <span className="text-discord-text-muted text-xs uppercase font-semibold tracking-wide">
          {t.common.search}
        </span>
      </div>

      <div className="flex gap-1 px-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder={t.profile.name}
          className="flex-1 bg-discord-input text-white text-sm rounded px-2 py-1 outline-none focus:ring-1 focus:ring-discord-accent placeholder-discord-text-muted min-w-0"
        />
        <button
          onClick={handleSearch}
          className="bg-discord-accent hover:bg-discord-accent-hover text-white text-xs px-2 py-1 rounded transition shrink-0"
        >
          {t.common.search}
        </button>
      </div>

      {results.map((u) => (
        <div key={u.id} className="flex items-center gap-2 px-2 py-1.5 rounded">
          <img
            src={getImageUrl(u.avatar_url)}
            alt={u.username}
            className="w-7 h-7 rounded-full object-cover cursor-pointer shrink-0"
            onClick={() => onOpenProfile(u.id)}
            onMouseEnter={(e) => showCard(u.id, (e.currentTarget as HTMLElement).getBoundingClientRect())}
            onMouseLeave={hideCard}
          />
          <span
            className="text-discord-text-secondary text-sm flex-1 truncate cursor-pointer hover:text-discord-text-primary"
            onClick={() => onOpenProfile(u.id)}
          >
            {u.username}
          </span>
          <button
            className="text-xs bg-discord-success hover:bg-discord-success-hover text-white px-2 py-0.5 rounded transition shrink-0"
            onClick={() => addFriend(u.id)}
            title={t.profile.add_friend}
          >
            +
          </button>
        </div>
      ))}
    </div>
  );
}
