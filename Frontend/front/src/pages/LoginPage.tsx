import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../services/api";
import Navbar from "../components/Navbar";
import AuthForm from "../components/AuthForm";
import "./LoginPage.css";

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ username: "", password: "" });
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(formData);
      navigate("/");
    } catch (err: any) {
      console.error("Login Error:", err);
      // ИЗМЕНЕНИЕ: Получаем текст ошибки от сервера
      const serverMessage = err.response?.data?.message;
      setError(serverMessage || "Ошибка входа");
    }
  };

  return (
    <div className="login-page">
      {/* <Navbar /> Если Navbar нужен на странице логина, раскомментируйте */}
      <div className="login-container">
        <h2 className="login-title">Вход</h2>
        {error && <div className="error-message">{error}</div>}
        <AuthForm
          type="login"
          formData={formData}
          onChange={handleChange}
          onSubmit={handleSubmit}
        />
        <p className="register-link">
          Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;