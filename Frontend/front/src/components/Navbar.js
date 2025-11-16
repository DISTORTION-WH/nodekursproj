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

  const leftLinks = isAuth
    ? [
        role === "ADMIN" &&
          React.createElement(
            Link,
            { key: "admin", to: "/admin", className: "btn" },
            "Админка"
          ),
      ]
    : [
        React.createElement(
          Link,
          { key: "login", to: "/login", className: "btn" },
          "Вход"
        ),
        React.createElement(
          Link,
          { key: "register", to: "/register", className: "btn" },
          "Регистрация"
        ),
      ];

  const avatarEl =
    isAuth && currentUser
      ? React.createElement(
          "div",
          { className: "avatar-wrapper" },
          React.createElement("img", {
            src: currentUser.avatar_url
              ? api.defaults.baseURL +
                currentUser.avatar_url +
                "?t=" +
                Date.now()
              : "/default-avatar.png",
            alt: "avatar",
            className: "avatar",
            onClick: () => navigate("/profile"),
          })
        )
      : null;

  const logoutBtn = isAuth
    ? React.createElement(
        "button",
        { key: "logout", onClick: handleLogout, className: "btn" },
        "Выход"
      )
    : null;

  return React.createElement(
    "nav",
    { className: "navbar" },
    React.createElement(
      Link,
      { to: "/", className: "logo", style: { textDecoration: "none" } },
      "Lume"
    ),
    React.createElement("div", null, ...leftLinks, avatarEl, logoutBtn)
  );
}
