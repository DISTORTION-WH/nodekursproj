import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n";
import ForgotPasswordModal from "./ForgotPasswordModal";

interface Props {
  type: "login" | "register";
}

export default function AuthForm({ type }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const { login } = useAuth();
  const { t } = useI18n();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setLoading(true);
    setError("");
    try {
      await login(username, password);
    } catch (err: any) {
      setError(err instanceof Error ? err.message : (err.response?.data?.message || t.auth.login_error));
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "white",
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.border = "1px solid rgba(88,101,242,0.7)";
    e.currentTarget.style.background = "rgba(255,255,255,0.09)";
    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(88,101,242,0.15)";
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.border = "1px solid rgba(255,255,255,0.1)";
    e.currentTarget.style.background = "rgba(255,255,255,0.06)";
    e.currentTarget.style.boxShadow = "none";
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden px-4">
      {/* Animated gradient background */}
      <div
        className="absolute inset-0 animate-gradient"
        style={{
          background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e, #1a1a2e, #16213e, #0f3460)",
        }}
      />

      {/* Floating orbs */}
      <div
        className="absolute w-96 h-96 rounded-full opacity-20 animate-orb"
        style={{
          background: "radial-gradient(circle, #5865f2 0%, transparent 70%)",
          top: "10%",
          left: "15%",
          filter: "blur(40px)",
        }}
      />
      <div
        className="absolute w-80 h-80 rounded-full opacity-15 animate-orb"
        style={{
          background: "radial-gradient(circle, #eb459e 0%, transparent 70%)",
          bottom: "15%",
          right: "10%",
          filter: "blur(50px)",
          animationDelay: "4s",
          animationDuration: "16s",
        }}
      />
      <div
        className="absolute w-64 h-64 rounded-full opacity-10 animate-orb"
        style={{
          background: "radial-gradient(circle, #57f287 0%, transparent 70%)",
          top: "50%",
          right: "25%",
          filter: "blur(60px)",
          animationDelay: "2s",
          animationDuration: "20s",
        }}
      />

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Card */}
      <div className="relative z-10 animate-fade-in-up w-full max-w-sm mx-auto">
        {/* Glow behind card */}
        <div
          className="absolute -inset-1 rounded-2xl opacity-30 blur-xl"
          style={{ background: "linear-gradient(135deg, #5865f2, #eb459e)" }}
        />

        <div
          className="relative rounded-2xl p-8 flex flex-col gap-5"
          style={{
            background: "rgba(30, 31, 48, 0.85)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
          }}
        >
          {/* Logo */}
          <div className="text-center mb-1">
            <span
              className="font-logo text-4xl tracking-widest"
              style={{
                background: "linear-gradient(135deg, #ffffff 0%, #a8b4ff 50%, #eb459e 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              LUME
            </span>
            <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>
              {type === "login" ? t.auth.welcome_back : t.auth.welcome}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm animate-fade-in-up">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>
                {t.auth.username}
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="username"
                autoComplete="username"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200"
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>
                {t.auth.password}
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200"
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>

            {/* Forgot password link */}
            <button
              type="button"
              onClick={() => setShowForgot(true)}
              className="text-xs text-right -mt-2 transition-colors duration-200"
              style={{ color: "rgba(168,180,255,0.7)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#a8b4ff")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(168,180,255,0.7)")}
            >
              {t.auth.forgot_password}
            </button>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all duration-200 animate-shimmer mt-1"
              style={{
                background: loading
                  ? "rgba(88,101,242,0.5)"
                  : "linear-gradient(135deg, #5865f2 0%, #7b68ee 50%, #eb459e 100%)",
                backgroundSize: "200% auto",
                boxShadow: loading ? "none" : "0 4px 20px rgba(88,101,242,0.4)",
                cursor: loading ? "not-allowed" : "pointer",
              }}
              onMouseEnter={e => {
                if (!loading) {
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "0 8px 30px rgba(88,101,242,0.5)";
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = loading ? "none" : "0 4px 20px rgba(88,101,242,0.4)";
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  {t.auth.logging_in}
                </span>
              ) : t.auth.login}
            </button>
          </form>

          {/* Footer link */}
          <p className="text-center text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
            {t.auth.no_account}{" "}
            <Link
              to="/register"
              className="font-semibold transition-colors duration-200"
              style={{ color: "#a8b4ff" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#eb459e")}
              onMouseLeave={e => (e.currentTarget.style.color = "#a8b4ff")}
            >
              {t.auth.register}
            </Link>
          </p>
        </div>
      </div>

      {/* Forgot password modal */}
      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
    </div>
  );
}
