import React, { useState, useEffect } from "react";
import api from "../../services/api";
import { useNavigate } from "react-router-dom";
import { User } from "../../types";
import { getImageUrl } from "../../utils/imageUrl";

export default function ProfileFriendList() {
  const [friends, setFriends] = useState<User[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get<User[]>("/friends")
      .then((res) => setFriends(res.data || []))
      .catch(() => setFriends([]));
  }, []);

  return (
    <section className="py-2.5 px-10 bg-[#202225] flex flex-col gap-1.5 shrink-0 md:p-5">
      <h3 className="m-0 font-bold text-xl mb-2">Друзья</h3>
      <ul className="flex gap-3 overflow-x-auto list-none p-2.5 m-0 scrollbar-thin min-h-[100px]">
        {friends && friends.length > 0 ? (
          friends.map((f) => (
            <li
              key={f.id}
              className="flex-none w-[180px] flex gap-2.5 items-center bg-white/5 p-3 rounded-xl transition-all cursor-pointer hover:bg-white/10 hover:-translate-y-1 md:w-[150px]"
              onClick={() => navigate(`/profile/${f.id}`)}
            >
              <img
                src={getImageUrl(f.avatar_url)}
                alt={f.username}
                className="w-12 h-12 rounded-full object-cover"
              />
              <div className="text-white font-semibold text-[0.95rem] whitespace-nowrap overflow-hidden text-ellipsis">
                {f.username}
              </div>
            </li>
          ))
        ) : (
          <div className="text-[#b9bbbe] p-2.5">
            Нет друзей
          </div>
        )}
      </ul>
    </section>
  );
}