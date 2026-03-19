import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getImageUrl } from "../utils/imageUrl";
import { AvatarWithFrame } from "./profile/AvatarFrameShop";
import { useI18n, LANGUAGES } from "../i18n";

export default function Navbar() {
  const navigate = useNavigate();
  const { isAuth, currentUser, logout } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);
  const [langOpen, setLangOpen] = useState(false);

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
        {/* Language switcher */}
        <div className="relative">
          <button
            onClick={() => setLangOpen(!langOpen)}
            className="px-2 py-1 rounded text-sm flex items-center gap-1"
            style={navLinkStyle("lang")}
            onMouseEnter={() => setHoveredLink("lang")}
            onMouseLeave={() => { if (!langOpen) setHoveredLink(null); }}
          >
            {LANGUAGES.find((l) => l.code === lang)?.flag ?? "🌐"}
          </button>
          {langOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setLangOpen(false)} />
              <div
                className="absolute right-0 top-full mt-1 z-50 rounded-lg overflow-hidden shadow-xl"
                style={{ background: "var(--color-secondary)", border: "1px solid var(--color-tertiary)", minWidth: 130 }}
              >
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => { setLang(l.code); setLangOpen(false); }}
                    className={`w-full px-3 py-2 text-sm text-left flex items-center gap-2 transition ${
                      lang === l.code ? "text-discord-accent" : "text-discord-text-secondary hover:text-discord-text-primary"
                    }`}
                    style={{ background: lang === l.code ? "rgba(88,101,242,0.1)" : "transparent" }}
                    onMouseEnter={(e) => { if (lang !== l.code) (e.currentTarget.style.background = "rgba(255,255,255,0.05)"); }}
                    onMouseLeave={(e) => { if (lang !== l.code) (e.currentTarget.style.background = "transparent"); }}
                  >
                    <span>{l.flag}</span>
                    <span>{l.label}</span>
                    {lang === l.code && <span className="ml-auto text-xs">✓</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

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
                {t.nav.admin}
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
                {t.nav.moderation}
              </Link>
            )}
            {currentUser && (
              <div className="cursor-pointer" onClick={() => navigate("/profile")}>
                <AvatarWithFrame
                  src={getImageUrl(currentUser.avatar_url)}
                  frame={currentUser.avatar_frame}
                  size={36}
                  className="hover:opacity-90 transition"
                />
              </div>
            )}
            <button
              onClick={handleLogout}
              className="px-3 py-1 rounded text-discord-text-secondary text-sm"
              style={navLinkStyle("logout")}
              onMouseEnter={() => setHoveredLink("logout")}
              onMouseLeave={() => setHoveredLink(null)}
            >
              {t.nav.logout}
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
              {t.nav.login}
            </Link>
            <Link
              to="/register"
              className="px-3 py-1 rounded text-white text-sm no-underline hover:opacity-90 transition-opacity"
              style={{ background: "linear-gradient(135deg, #5865f2, #7b68ee)" }}
            >
              {t.nav.register}
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
