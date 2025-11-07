import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import "./AuthForm.css";

export default function AuthForm({ type, setIsAuth, setRole, setCurrentUser }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!username || !password) {
      setError("Введите имя пользователя и пароль");
      return;
    }

    try {
      const res = await axios.post("/auth/login", { username, password });

      const token = res.data.accessToken;
      localStorage.setItem("token", token);

      if (setIsAuth) setIsAuth(true);
      if (setRole) setRole(jwtDecode(token).role || "USER");

      if (setCurrentUser) {
        const resUser = await axios.get("/users/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setCurrentUser(resUser.data);
      }

      navigate("/");
    } catch (err) {
      console.error(err.response?.data || err);
      setError(err.response?.data?.message || "Ошибка входа");
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
