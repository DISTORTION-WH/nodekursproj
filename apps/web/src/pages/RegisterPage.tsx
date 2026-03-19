import React, { useState, useEffect, useRef, FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

export default function RegisterPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  // Revoke previous blob URL to avoid memory leaks
  const prevBlobUrl = useRef<string | null>(null);
  useEffect(() => {
    return () => {
      if (prevBlobUrl.current) URL.revokeObjectURL(prevBlobUrl.current);
    };
  }, []);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (prevBlobUrl.current) URL.revokeObjectURL(prevBlobUrl.current);
      const url = URL.createObjectURL(file);
      prevBlobUrl.current = url;
      setAvatar(file);
      setAvatarPreview(url);
    }
  };

  const handlePreRegister = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !email.trim() || !password.trim()) return;
    setLoading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("username", username);
      formData.append("email", email);
      formData.append("password", password);
      if (avatar) formData.append("avatar", avatar);
      await api.post("/auth/pre-registration", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setStep(2);
    } catch (err: any) {
      setError(err.response?.data?.message || "Ошибка регистрации");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (e: FormEvent) => {
    e.preventDefault();
    if (!verificationCode.trim()) return;
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/confirm-registration", {
        email,
        code: verificationCode,
      });
      await login(username, password);
    } catch (err: any) {
      setError(err.response?.data?.message || "Ошибка подтверждения");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "white",
  };
  const inputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.border = "1px solid rgba(88,101,242,0.7)";
    e.currentTarget.style.background = "rgba(255,255,255,0.09)";
    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(88,101,242,0.15)";
  };
  const inputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
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
      <div className="absolute w-96 h-96 rounded-full opacity-20 animate-orb" style={{ background: "radial-gradient(circle, #5865f2 0%, transparent 70%)", top: "10%", left: "15%", filter: "blur(40px)" }} />
      <div className="absolute w-80 h-80 rounded-full opacity-15 animate-orb" style={{ background: "radial-gradient(circle, #eb459e 0%, transparent 70%)", bottom: "15%", right: "10%", filter: "blur(50px)", animationDelay: "4s", animationDuration: "16s" }} />
      <div className="absolute w-64 h-64 rounded-full opacity-10 animate-orb" style={{ background: "radial-gradient(circle, #57f287 0%, transparent 70%)", top: "50%", right: "25%", filter: "blur(60px)", animationDelay: "2s", animationDuration: "20s" }} />

      {/* Grid overlay */}
      <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

      {/* Card */}
      <div className="relative z-10 animate-fade-in-up w-full max-w-sm mx-auto">
        <div className="absolute -inset-1 rounded-2xl opacity-30 blur-xl" style={{ background: "linear-gradient(135deg, #5865f2, #eb459e)" }} />

        <div className="relative rounded-2xl p-8 flex flex-col gap-5" style={{ background: "rgba(30, 31, 48, 0.85)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 25px 60px rgba(0,0,0,0.5)" }}>

          {/* Logo + step indicator */}
          <div className="text-center mb-1">
            <span className="font-logo text-4xl tracking-widest" style={{ background: "linear-gradient(135deg, #ffffff 0%, #a8b4ff 50%, #eb459e 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              LUME
            </span>
            <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>
              {step === 1 ? "Создать аккаунт" : "Подтвердите email"}
            </p>
            {/* Step dots */}
            <div className="flex justify-center gap-2 mt-3">
              {[1, 2].map(s => (
                <div key={s} className="h-1.5 rounded-full transition-all duration-300" style={{ width: s === step ? "24px" : "8px", background: s === step ? "#5865f2" : "rgba(255,255,255,0.2)" }} />
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm animate-fade-in-up">
              {error}
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handlePreRegister} className="flex flex-col gap-4">
              {/* Avatar upload */}
              <div className="flex justify-center">
                <label className="cursor-pointer group relative">
                  <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center transition-all duration-200" style={{ background: "rgba(88,101,242,0.15)", border: "2px dashed rgba(88,101,242,0.4)" }}>
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      <svg className="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    )}
                    <div className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "rgba(0,0,0,0.5)" }}>
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                </label>
              </div>

              {[
                { label: "Имя пользователя", value: username, setter: setUsername, type: "text", placeholder: "username", autocomplete: "username" },
                { label: "Email", value: email, setter: setEmail, type: "email", placeholder: "you@example.com", autocomplete: "email" },
                { label: "Пароль", value: password, setter: setPassword, type: "password", placeholder: "••••••••", autocomplete: "new-password" },
              ].map(({ label, value, setter, type, placeholder, autocomplete }) => (
                <div key={label} className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>{label}</label>
                  <input
                    type={type}
                    value={value}
                    onChange={e => setter(e.target.value)}
                    placeholder={placeholder}
                    autoComplete={autocomplete}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200"
                    style={inputStyle}
                    onFocus={inputFocus}
                    onBlur={inputBlur}
                  />
                </div>
              ))}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all duration-200 mt-1"
                style={{ background: loading ? "rgba(88,101,242,0.5)" : "linear-gradient(135deg, #5865f2, #7b68ee 50%, #eb459e)", backgroundSize: "200% auto", boxShadow: loading ? "none" : "0 4px 20px rgba(88,101,242,0.4)", cursor: loading ? "not-allowed" : "pointer" }}
                onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 8px 30px rgba(88,101,242,0.5)"; } }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = loading ? "none" : "0 4px 20px rgba(88,101,242,0.4)"; }}
              >
                {loading ? "Отправляем код..." : "Далее →"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleConfirm} className="flex flex-col gap-4">
              <p className="text-sm text-center" style={{ color: "rgba(255,255,255,0.5)" }}>
                Мы отправили код на <span className="text-white font-medium">{email}</span>
              </p>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Код подтверждения</label>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={e => setVerificationCode(e.target.value)}
                  placeholder="123456"
                  maxLength={8}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200 text-center tracking-[0.3em] text-lg font-mono"
                  style={inputStyle}
                  onFocus={inputFocus}
                  onBlur={inputBlur}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all duration-200"
                style={{ background: loading ? "rgba(88,101,242,0.5)" : "linear-gradient(135deg, #5865f2, #7b68ee 50%, #eb459e)", boxShadow: loading ? "none" : "0 4px 20px rgba(88,101,242,0.4)", cursor: loading ? "not-allowed" : "pointer" }}
                onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 8px 30px rgba(88,101,242,0.5)"; } }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = loading ? "none" : "0 4px 20px rgba(88,101,242,0.4)"; }}
              >
                {loading ? "Регистрируемся..." : "Создать аккаунт"}
              </button>

              <button
                type="button"
                onClick={() => { setStep(1); setError(""); }}
                className="text-sm transition-colors duration-200"
                style={{ color: "rgba(255,255,255,0.35)", background: "none", border: "none", cursor: "pointer" }}
                onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
              >
                ← Назад
              </button>
            </form>
          )}

          <p className="text-center text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
            Уже есть аккаунт?{" "}
            <Link
              to="/login"
              className="font-semibold transition-colors duration-200"
              style={{ color: "#a8b4ff" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#eb459e")}
              onMouseLeave={e => (e.currentTarget.style.color = "#a8b4ff")}
            >
              Войти
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
