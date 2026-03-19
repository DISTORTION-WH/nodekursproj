import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getImageUrl } from "../utils/imageUrl";

export default function Navbar() {
  const navigate = useNavigate();
  const { isAuth, currentUser, logout } = useAuth();
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isAdmin = currentUser?.role === "ADMIN";
  const isModerator = currentUser?.role === "MODERATOR";

  const navLinkStyle = (id: string) => ({
    background: hoveredLink === id ? "rgba(255,255,255,0.08)" : "transparent",
    transition: "background 0.15s",
  });

  return (
    <nav
      className="fixed top-0 left-0 right-0 h-[50px] flex items-center justify-between px-4 z-50"
      style={{
        background: "var(--color-secondary)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid var(--color-tertiary)",
      }}
    >
      <Link
        to="/"
        className="font-logo text-2xl tracking-widest no-underline transition-opacity hover:opacity-90"
      >
        <span
          style={{
            background: "linear-gradient(135deg, #ffffff, #a8b4ff)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Lume
        </span>
      </Link>
      <div className="flex items-center gap-2">
        {isAuth ? (
          <>
            {isAdmin && (
              <Link
                to="/admin"
                className="px-3 py-1 rounded text-discord-text-secondary text-sm no-underline"
                style={navLinkStyle("admin")}
                onMouseEnter={() => setHoveredLink("admin")}
                onMouseLeave={() => setHoveredLink(null)}
              >
                Админка
              </Link>
            )}
            {(isModerator || isAdmin) && (
              <Link
                to="/moderator"
                className="px-3 py-1 rounded text-sm no-underline transition"
                style={{
                  color: "#faa61a",
                  border: "1px solid #faa61a",
                  background:
                    hoveredLink === "moderator" ? "#faa61a" : "transparent",
                  ...(hoveredLink === "moderator"
                    ? { color: "#1e1f30" }
                    : {}),
                }}
                onMouseEnter={() => setHoveredLink("moderator")}
                onMouseLeave={() => setHoveredLink(null)}
              >
                Модерация
              </Link>
            )}
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
              className="px-3 py-1 rounded text-discord-text-secondary text-sm"
              style={navLinkStyle("logout")}
              onMouseEnter={() => setHoveredLink("logout")}
              onMouseLeave={() => setHoveredLink(null)}
            >
              Выход
            </button>
          </>
        ) : (
          <>
            <Link
              to="/login"
              className="px-3 py-1 rounded text-discord-text-secondary text-sm no-underline"
              style={navLinkStyle("login")}
              onMouseEnter={() => setHoveredLink("login")}
              onMouseLeave={() => setHoveredLink(null)}
            >
              Вход
            </Link>
            <Link
              to="/register"
              className="px-3 py-1 rounded text-white text-sm no-underline hover:opacity-90 transition-opacity"
              style={{ background: "linear-gradient(135deg, #5865f2, #7b68ee)" }}
            >
              Регистрация
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
