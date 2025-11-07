// src/components/Navbar.js
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Navbar.css";
import axios from "axios";
export default function Navbar({
  isAuth,
  setIsAuth,
  role,
  setRole,
  currentUser,
}) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    setIsAuth(false);
    setRole(null);
    navigate("/login");
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
            // src: currentUser.avatar_url
            //   ? "http://localhost:5000" + currentUser.avatar_url + "?t=" + Date.now() тут тоже для локалхоста
            //   : "/default-avatar.png",
            src: currentUser.avatar_url
              ? axios.defaults.baseURL +
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

  return React.createElement(
    "nav",
    { className: "navbar" },
    React.createElement(
      Link,
      { to: "/", className: "logo", style: { textDecoration: "none" } },
      "Lume"
    ),
    React.createElement("div", null, ...leftLinks, avatarEl)
  );
}
