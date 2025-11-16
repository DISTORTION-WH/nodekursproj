import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import "./AuthForm.css";

export default function AuthForm({ type }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!username || !password) {
      setError("Введите имя пользователя и пароль");
      return;
    }

    try {
      await login(username, password);
    } catch (err) {
      console.error(err);
      setError(err || "Неизвестная ошибка входа");
    }
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <h2>Вход</h2>
      {error && <div className="error">{error}</div>}
      <input
        type="text"
        placeholder="Имя пользователя"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Пароль"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button type="submit" className="btn primary">
        Войти
      </button>
    </form>
  );
}
