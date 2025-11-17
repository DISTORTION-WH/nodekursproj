import React, { useState, FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import "./AuthForm.css";

interface AuthFormProps {
  type?: "login" | "register"; // Пропc type есть в JS версии, оставим его опциональным
}

export default function AuthForm({ type }: AuthFormProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username || !password) {
      setError("Введите имя пользователя и пароль");
      return;
    }

    try {
      await login(username, password);
    } catch (err: any) {
      console.error(err);
      setError(typeof err === 'string' ? err : "Неизвестная ошибка входа");
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