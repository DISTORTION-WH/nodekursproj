import React, { useState } from "react";
import api from "../services/api";
import { useI18n } from "../i18n";

interface Props {
  onClose: () => void;
}

export default function ForgotPasswordModal({ onClose }: Props) {
  const { t } = useI18n();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/forgot-password", { email });
      setStep("code");
    } catch (err: any) {
      setError(err.response?.data?.message || t.common.error);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !newPassword.trim()) return;
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/reset-password", { email, code, newPassword });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.message || t.common.error);
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200";
  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "white",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-sm rounded-2xl p-8 flex flex-col gap-5 animate-fade-in-up"
        style={{
          background: "rgba(30, 31, 48, 0.95)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
        }}
      >
        <div className="text-center">
          <h2
            className="text-xl font-bold"
            style={{
              background: "linear-gradient(135deg, #fff, #a8b4ff)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {t.auth.reset_password}
          </h2>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {success ? (
          <div className="flex flex-col gap-4 items-center">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center text-3xl">
              ✓
            </div>
            <p className="text-green-400 text-sm text-center">{t.auth.reset_success}</p>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl font-semibold text-sm text-white"
              style={{ background: "linear-gradient(135deg, #5865f2, #7b68ee)" }}
            >
              {t.auth.back_to_login}
            </button>
          </div>
        ) : step === "email" ? (
          <form onSubmit={handleSendCode} className="flex flex-col gap-4">
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
              {t.auth.enter_email}
            </p>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@example.com"
              className={inputCls}
              style={inputStyle}
              autoFocus
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-sm text-white"
              style={{
                background: loading ? "rgba(88,101,242,0.5)" : "linear-gradient(135deg, #5865f2, #7b68ee)",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? t.auth.sending : t.auth.send_code}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-sm transition-colors"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              {t.auth.back_to_login}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
            <p className="text-sm text-green-400">{t.auth.reset_email_sent}</p>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>
                {t.auth.confirm_code}
              </label>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="000000"
                className={inputCls}
                style={{ ...inputStyle, textAlign: "center", letterSpacing: "0.3em", fontSize: "1.2rem" }}
                maxLength={6}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>
                {t.auth.new_password}
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className={inputCls}
                style={inputStyle}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-sm text-white"
              style={{
                background: loading ? "rgba(88,101,242,0.5)" : "linear-gradient(135deg, #5865f2, #7b68ee)",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? t.auth.sending : t.auth.reset_password}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
