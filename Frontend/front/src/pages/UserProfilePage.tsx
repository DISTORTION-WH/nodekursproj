import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";
import { User } from "../types";
import { getImageUrl } from "../utils/imageUrl";

export default function UserProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [friends, setFriends] = useState<User[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!userId) return;
    api.get<User>(`/users/${userId}`)
      .then((res) => {
        setUser(res.data);
        setFriends(res.data.friends || []);
      })
      .catch((err) => {
        console.error(err);
        alert("Ошибка при загрузке профиля пользователя");
        navigate(-1);
      });
  }, [userId, navigate]);

  const startChat = async () => {
    if (!user) return;
    try {
      const friendId = user.id;
      const res = await api.post<{ id: number }>("/chats/private", { friendId });
      if (!res.data || !res.data.id) return;
      navigate("/", {
        state: {
          openChatId: res.data.id,
          friend: { username: user.username, avatar_url: user.avatar_url },
        },
      });
    } catch (err: any) {
      alert("Ошибка при создании чата");
    }
  };

  const removeFriend = async () => {
    if (!user || !window.confirm("Удалить из друзей?")) return;
    try {
      await api.post(`/friends/remove`, { friendId: user.id });
      alert("Пользователь удалён из друзей");
      navigate(-1);
    } catch (err) {
      alert("Ошибка при удалении из друзей");
    }
  };

  if (!user) {
    return <p className="text-center mt-10 text-lg text-text-muted">Загрузка...</p>;
  }

  return (
    <div className="w-full h-full bg-bg text-text-main font-sans flex flex-col overflow-y-auto box-border gap-2.5 pb-2.5">
      <h1 className="text-2xl font-bold text-left p-5 bg-bg-block m-0 shrink-0 md:text-[1.6rem] md:p-5 md:px-5">Профиль</h1>

      <div className="flex flex-wrap items-center gap-[30px] p-5 px-10 bg-bg-block shrink-0 md:flex-col md:items-start md:p-5">
        <img
          src={getImageUrl(user.avatar_url)}
          alt="avatar"
          className="w-40 h-40 rounded-full object-cover border-[3px] border-black/40 shadow-lg transition-transform duration-300 hover:scale-105 md:w-[100px] md:h-[100px]"
        />
        <div className="flex flex-col gap-1 text-[0.95rem] max-w-[300px]">
          <h2 className="text-2xl font-bold m-0">{user.username}</h2>
          <p className="m-0 text-text-muted">Роль: {user.role || "USER"}</p>
          <p className="m-0 text-text-muted">
            Зарегистрирован: {user.created_at ? new Date(user.created_at).toLocaleDateString() : "-"}
          </p>
        </div>
      </div>

      <div className="py-5 px-10 bg-bg-block flex flex-col gap-2 shrink-0 md:p-5">
        <h3 className="m-0 font-bold text-xl">Друзья</h3>
        {friends.length === 0 ? (
          <p className="text-text-muted p-2.5">Нет друзей</p>
        ) : (
          <ul className="flex gap-3 overflow-x-auto list-none p-2.5 m-0 scrollbar-thin">
            {friends.map((friend) => (
              <li
                key={friend.id}
                className="flex-none w-[180px] flex gap-2.5 items-center bg-white/5 p-3 rounded-xl transition-all duration-200 cursor-pointer hover:bg-white/10 hover:-translate-y-1 md:w-[150px]"
                onClick={() => navigate(`/profile/${friend.id}`)}
              >
                <img
                  src={getImageUrl(friend.avatar_url)}
                  alt="friend-avatar"
                  className="w-12 h-12 rounded-full object-cover"
                />
                <span className="font-semibold text-[0.95rem] whitespace-nowrap overflow-hidden text-ellipsis text-white">
                  {friend.username}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-2.5 mx-10 flex gap-3 justify-start shrink-0 md:m-0 md:p-5 md:flex-col md:items-stretch">
        <button 
          onClick={startChat} 
          className="bg-accent border-none py-2.5 px-4.5 rounded-lg cursor-pointer text-white font-semibold transition-colors hover:bg-accent-hover md:w-full md:text-center"
        >
          Начать чат
        </button>
        <button 
          onClick={removeFriend} 
          className="bg-[#e81123] border-none py-2.5 px-4.5 rounded-lg cursor-pointer text-white font-semibold transition-colors hover:bg-[#c50f1f] md:w-full md:text-center"
        >
          Удалить из друзей
        </button>
      </div>
    </div>
  );
}