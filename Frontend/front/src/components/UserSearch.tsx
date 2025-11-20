import React, { useState } from "react";
import api from "../services/api";
import { User } from "../types";
import { getImageUrl } from "../utils/imageUrl";

interface UserSearchProps {
  onOpenProfile: (id: number) => void;
}

export default function UserSearch({ onOpenProfile }: UserSearchProps) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<User[]>([]);

  const handleSearch = () => {
    if (!search.trim()) return;
    api.get<User[]>(`/users?search=${encodeURIComponent(search)}`)
      .then((res) => setResults(res.data))
      .catch(console.error);
  };

  const addFriend = (id: number) => {
    api.post<{ message: string }>("/friends/request", { friendId: id })
      .then((res) => {
        alert(res.data.message);
        setSearch("");
        setResults([]);
      })
      .catch(console.error);
  };

  return (
    <div className="mt-2.5">
      <h3 className="text-[#b9bbbe] text-xs font-bold uppercase mb-2">Поиск</h3>
      <div className="flex gap-1 mb-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Имя..."
            className="flex-1 bg-[#202225] text-white border-none rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-accent placeholder-[#72767d]"
          />
          <button 
            onClick={handleSearch}
            className="bg-accent text-white border-none rounded px-2 text-sm cursor-pointer hover:bg-accent-hover"
          >
            Найти
          </button>
      </div>
      
      <div className="flex flex-col gap-1">
        {results.map((u) => (
          <div key={u.id} className="flex items-center justify-between p-2 rounded hover:bg-[#36393f] bg-[#2f3136]">
            <div className="flex items-center gap-2 overflow-hidden">
              <img
                src={getImageUrl(u.avatar_url)}
                alt="ava"
                className="w-6 h-6 rounded-full object-cover cursor-pointer"
                onClick={() => onOpenProfile(u.id)}
              />
              <span className="text-white text-sm truncate">{u.username}</span>
            </div>
            <button 
              onClick={() => addFriend(u.id)}
              className="bg-transparent text-accent border border-accent py-0.5 px-2 rounded text-xs cursor-pointer hover:bg-accent hover:text-white transition-colors"
            >
              +
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}