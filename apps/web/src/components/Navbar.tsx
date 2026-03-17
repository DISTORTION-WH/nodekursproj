import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getImageUrl } from "../utils/imageUrl";

export default function Navbar() {
  const navigate = useNavigate();
  const { isAuth, currentUser, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isAdmin = currentUser?.role === "ADMIN";
  const isModerator = currentUser?.role === "MODERATOR";

  return (
    <nav className="fixed top-0 left-0 right-0 h-[50px] bg-discord-tertiary flex items-center justify-between px-4 z-50 shadow-md">
      <Link
        to="/"
        className="font-logo text-2xl text-white tracking-widest no-underline hover:text-discord-accent transition-colors"
      >
        Lume
      </Link>
      <div className="flex items-center gap-2">
        {isAuth ? (
          <>
            {isAdmin && (
              <Link
                to="/admin"
                className="px-3 py-1 rounded text-discord-text-secondary hover:bg-discord-input hover:text-white transition text-sm no-underline"
              >
                Админка
              </Link>
            )}
            {(isModerator || isAdmin) && (
              <Link
                to="/moderator"
                className="px-3 py-1 rounded text-yellow-400 border border-yellow-400 hover:bg-yellow-400 hover:text-discord-tertiary transition text-sm no-underline"
              >
                Модерация
              </Link>
            )}
            <Link
              to="/calls"
              className="px-3 py-1 rounded text-discord-text-secondary hover:bg-discord-input hover:text-white transition text-sm no-underline"
              title="История звонков"
            >
              📞 Звонки
            </Link>
            {currentUser && (
              <img
                src={getImageUrl(currentUser.avatar_url)}
                alt="avatar"
                className="w-9 h-9 rounded-full object-cover cursor-pointer hover:ring-2 hover:ring-discord-accent transition"
                onClick={() => navigate("/profile")}
              />
            )}
            <button
              onClick={handleLogout}
              className="px-3 py-1 rounded text-discord-text-secondary hover:bg-discord-input hover:text-white transition text-sm"
            >
              Выход
            </button>
          </>
        ) : (
          <>
            <Link
              to="/login"
              className="px-3 py-1 rounded text-discord-text-secondary hover:bg-discord-input hover:text-white transition text-sm no-underline"
            >
              Вход
            </Link>
            <Link
              to="/register"
              className="px-3 py-1 rounded bg-discord-accent text-white hover:bg-discord-accent-hover transition text-sm no-underline"
            >
              Регистрация
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
