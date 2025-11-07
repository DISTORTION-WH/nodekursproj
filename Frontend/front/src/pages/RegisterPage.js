import React, { useState } from "react";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import { useNavigate } from "react-router-dom";
import "../components/AuthForm.css";

export default function RegisterPage({ setIsAuth, setRole, setCurrentUser }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [avatar, setAvatar] = useState(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handlePreRegister = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const formData = new FormData();
      formData.append("username", username);
      formData.append("email", email);
      formData.append("password", password);
      if (avatar) formData.append("avatar", avatar);

      await axios.post("/auth/pre-registration", formData, {
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
      await axios.post("/auth/confirm-registration", {
        email,
        code: verificationCode,
      });

      const resLogin = await axios.post("/auth/login", { username, password });
      const token = resLogin.data.accessToken;
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
      console.error(err);
      setError(err.response?.data?.message || "Ошибка подтверждения");
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
