// Frontend/front/src/pages/ProfilePage.js
import React from "react";
import { useNavigate } from "react-router-dom";
import "./ProfilePage.css";

// Импортируем новые компоненты
import ProfileHeader from "../components/profile/ProfileHeader";
import ProfileFriendList from "../components/profile/ProfileFriendList";
import ChangePasswordForm from "../components/profile/ChangePasswordForm";

export default function ProfilePage({
  currentUser,
  handleAvatarChange,
  setIsAuth,
  setRole,
}) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    setIsAuth(false);
    setRole(null);
    navigate("/login");
  };

  return (
    <div className="profile-page">
      {/* Мы используем <div className="profile-card"> 
        (который в CSS = display: contents) 
        чтобы сохранить оригинальную flex-структуру 
      */}
      <div className="profile-card">
        <h2 className="profile-title">Мой профиль</h2>

        <ProfileHeader
          currentUser={currentUser}
          handleAvatarChange={handleAvatarChange}
        />

        <ProfileFriendList />

        <ChangePasswordForm />

        {/* Секцию с кнопкой Выхода можно оставить здесь, 
          так как она напрямую управляет состоянием App.js
        */}
        <section
          className="profile-logout-section"
          style={{ padding: "20px 40px", background: "#202225" }}
        >
          <button className="profile-logout-btn" onClick={handleLogout}>
            Выйти
          </button>
        </section>
      </div>
    </div>
  );
}
