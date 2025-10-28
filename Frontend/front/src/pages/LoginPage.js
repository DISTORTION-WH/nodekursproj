import React from "react";
import AuthForm from "../components/AuthForm";

export default function LoginPage({ setIsAuth, setRole, setCurrentUser }) {
  return (
    <AuthForm
      type="login"
      setIsAuth={setIsAuth}
      setRole={setRole}
      setCurrentUser={setCurrentUser} // добавлено
    />
  );
}
