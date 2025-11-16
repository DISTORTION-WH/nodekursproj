import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import "../components/AuthForm.css";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [avatar, setAvatar] = useState(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const { login } = useAuth();

  const handlePreRegister = async (e) => {
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
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Ошибка регистрации");
    }
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    setError("");

    try {
      await api.post("/auth/confirm-registration", {
        email,
        code: verificationCode,
      });

      await login(username, password);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || err || "Ошибка подтверждения");
    }
  };

  return (
    <form
      className="auth-form"
      onSubmit={step === 1 ? handlePreRegister : handleConfirm}
    >
      <h2>{step === 1 ? "Регистрация" : "Подтверждение email"}</h2>
      {error && <div className="error">{error}</div>}

      {step === 1 ? (
        <>
          <input
            type="text"
            placeholder="Имя пользователя"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setAvatar(e.target.files[0])}
          />
          <button type="submit" className="btn primary">
            Зарегистрироваться
          </button>
        </>
      ) : (
        <>
          <input
            type="text"
            placeholder="Введите код подтверждения"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value)}
            required
          />
          <button type="submit" className="btn primary">
            Подтвердить
          </button>
        </>
      )}
    </form>
  );
}
