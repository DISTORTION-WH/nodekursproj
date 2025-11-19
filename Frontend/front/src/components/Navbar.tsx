import React from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Navbar.css";
import { useAuth } from "../context/AuthContext";
import { getImageUrl } from "../utils/imageUrl";

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
                  src={getImageUrl(currentUser.avatar_url)}
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