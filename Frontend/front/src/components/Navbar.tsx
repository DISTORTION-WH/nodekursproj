import React from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Navbar.css";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const navigate = useNavigate();
  const { isAuth, role, currentUser, logout } = useAuth();

  const handleLogout = () => {
    logout();
  };

  return (
    <nav className="navbar">
      <Link to="/" className="logo" style={{ textDecoration: "none" }}>
        Lume
      </Link>
      <div>
        {isAuth ? (
          <>
            {role === "ADMIN" && (
              <Link key="admin" to="/admin" className="btn">
                Админка
              </Link>
            )}
            {currentUser && (
              <div className="avatar-wrapper">
                <img
                  src={
                    currentUser.avatar_url
                      ? api.defaults.baseURL +
                        currentUser.avatar_url +
                        "?t=" +
                        Date.now()
                      : "/default-avatar.png"
                  }
                  alt="avatar"
                  className="avatar"
                  onClick={() => navigate("/profile")}
                />
              </div>
            )}
            <button key="logout" onClick={handleLogout} className="btn">
              Выход
            </button>
          </>
        ) : (
          <>
            <Link key="login" to="/login" className="btn">
              Вход
            </Link>
            <Link key="register" to="/register" className="btn">
              Регистрация
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
