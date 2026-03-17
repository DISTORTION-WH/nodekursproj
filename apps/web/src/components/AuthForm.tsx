import React, { useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface AuthFormProps {
  type?: "login" | "register";
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
      setError(typeof err === "string" ? err : "Неизвестная ошибка входа");
    }
  };

  return (
    <div className="min-h-screen bg-discord-bg flex items-center justify-center">
      <form
        className="bg-discord-secondary rounded-lg p-8 w-80 shadow-2xl flex flex-col gap-4"
        onSubmit={handleSubmit}
      >
        <h2 className="text-white text-xl font-bold text-center">Вход</h2>

        {error && (
          <div className="bg-discord-danger/20 border border-discord-danger text-discord-danger rounded px-3 py-2 text-sm">
            {error}
          </div>
        )}

        <input
          type="text"
          placeholder="Имя пользователя"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          className="bg-discord-input text-white rounded px-3 py-2 outline-none focus:ring-2 focus:ring-discord-accent placeholder-discord-text-muted"
        />
        <input
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="bg-discord-input text-white rounded px-3 py-2 outline-none focus:ring-2 focus:ring-discord-accent placeholder-discord-text-muted"
        />

        <button
          type="submit"
          className="bg-discord-accent hover:bg-discord-accent-hover text-white font-semibold rounded py-2 transition"
        >
          Войти
        </button>

        <p className="text-discord-text-muted text-sm text-center">
          Нет аккаунта?{" "}
          <Link to="/register" className="text-discord-accent hover:underline">
            Зарегистрируйтесь
          </Link>
        </p>
      </form>
    </div>
  );
}
