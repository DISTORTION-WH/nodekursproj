import React, { useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const { login } = useAuth();

  const inputClass =
    "bg-discord-input text-white rounded px-3 py-2 outline-none focus:ring-2 focus:ring-discord-accent placeholder-discord-text-muted w-full";

  const handlePreRegister = async (e: FormEvent) => {
    e.preventDefault();
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
    }
  };

  const handleConfirm = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/auth/confirm-registration", {
        email,
        code: verificationCode,
      });
      await login(username, password);
    } catch (err: any) {
      setError(err.response?.data?.message || "Ошибка подтверждения");
    }
  };

  return (
    <div className="min-h-screen bg-discord-bg flex items-center justify-center">
      <form
        className="bg-discord-secondary rounded-lg p-8 w-80 shadow-2xl flex flex-col gap-4"
        onSubmit={step === 1 ? handlePreRegister : handleConfirm}
      >
        <h2 className="text-white text-xl font-bold text-center">
          {step === 1 ? "Регистрация" : "Подтверждение email"}
        </h2>

        {error && (
          <div className="bg-discord-danger/20 border border-discord-danger text-discord-danger rounded px-3 py-2 text-sm">
            {error}
          </div>
        )}

        {step === 1 ? (
          <>
            <input
              type="text"
              placeholder="Имя пользователя"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className={inputClass}
            />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={inputClass}
            />
            <input
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={inputClass}
            />
            <label className="text-discord-text-muted text-sm">
              Аватар (необязательно)
              <input
                type="file"
                accept="image/*"
                className="mt-1 block text-sm text-discord-text-secondary file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-discord-input file:text-white hover:file:bg-discord-input-hover cursor-pointer"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setAvatar(e.target.files[0]);
                  }
                }}
              />
            </label>
            <button
              type="submit"
              className="bg-discord-accent hover:bg-discord-accent-hover text-white font-semibold rounded py-2 transition"
            >
              Зарегистрироваться
            </button>
          </>
        ) : (
          <>
            <p className="text-discord-text-secondary text-sm text-center">
              Код отправлен на <strong>{email}</strong>
            </p>
            <input
              type="text"
              placeholder="Код подтверждения"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              required
              className={inputClass}
            />
            <button
              type="submit"
              className="bg-discord-accent hover:bg-discord-accent-hover text-white font-semibold rounded py-2 transition"
            >
              Подтвердить
            </button>
          </>
        )}

        <p className="text-discord-text-muted text-sm text-center">
          Уже есть аккаунт?{" "}
          <Link to="/login" className="text-discord-accent hover:underline">
            Войдите
          </Link>
        </p>
      </form>
    </div>
  );
}
