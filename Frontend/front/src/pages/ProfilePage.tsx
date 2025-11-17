import React from "react";
import "./ProfilePage.css";

import ProfileHeader from "../components/profile/ProfileHeader";
import ProfileFriendList from "../components/profile/ProfileFriendList";
import ChangePasswordForm from "../components/profile/ChangePasswordForm";
import { useAuth } from "../context/AuthContext";

export default function ProfilePage() {
  const { currentUser, handleAvatarChange } = useAuth();

  return (
    <div className="profile-page">
      <div className="profile-card">
        <h2 className="profile-title">Мой профиль</h2>

        <ProfileHeader
          currentUser={currentUser}
          handleAvatarChange={handleAvatarChange}
        />

        <ProfileFriendList />

        <ChangePasswordForm />
      </div>
    </div>
  );
}
