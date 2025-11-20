import React, { useState, FormEvent } from "react";
import { useAuth } from "../context/AuthContext";

interface AuthFormProps {
  type?: "login" | "register"; 
}

export default function AuthForm({ type }: AuthFormProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState(""); 
  const { login, register, error } = useAuth();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (type === "register") {
      await register(username, email, password);
    } else {
      await login(username, password);
    }
  };

  const isRegister = type === "register";

  return (
    <form 
      onSubmit={handleSubmit}
      className="bg-bg text-white p-8 rounded-lg w-80 mx-auto mt-[70px] shadow-lg animate-fadeIn font-sans max-w-[90%] md:mt-10"
    >
      <h2 className="text-center mb-5 font-semibold text-2xl">
        {isRegister ? "Регистрация" : "Вход"}
      </h2>
      
      {error && (
        <div className="bg-danger p-2 rounded text-white text-sm text-center mb-4">
          {error}
        </div>
      )}
      
      <input
        type="text"
        placeholder="Имя пользователя"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
        className="w-full block p-2.5 mb-4 rounded border-none bg-bg-hover text-white outline-none text-[0.95rem] transition-colors focus:bg-bg-active placeholder-text-muted"
      />

      {isRegister && (
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full block p-2.5 mb-4 rounded border-none bg-bg-hover text-white outline-none text-[0.95rem] transition-colors focus:bg-bg-active placeholder-text-muted"
        />
      )}
      
      <input
        type="password"
        placeholder="Пароль"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        className="w-full block p-2.5 mb-4 rounded border-none bg-bg-hover text-white outline-none text-[0.95rem] transition-colors focus:bg-bg-active placeholder-text-muted"
      />
      
      <button 
        type="submit"
        className="w-full bg-accent text-white border-none p-2.5 font-bold cursor-pointer rounded transition-all duration-200 hover:bg-accent-hover hover:scale-105 mt-2.5"
      >
        {isRegister ? "Зарегистрироваться" : "Войти"}
      </button>
    </form>
  );
}