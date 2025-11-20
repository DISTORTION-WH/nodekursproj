import React from "react";
// import "./ProfilePage.css";
import ProfileHeader from "../components/profile/ProfileHeader";
import ProfileFriendList from "../components/profile/ProfileFriendList";
import ChangePasswordForm from "../components/profile/ChangePasswordForm";
import { useAuth } from "../context/AuthContext";

export default function ProfilePage() {
  const { currentUser, handleAvatarChange } = useAuth();

  return (
    <div className={`
      w-full h-full bg-bg text-text-main font-sans flex flex-col overflow-y-auto box-border gap-2.5 pb-2.5
      
      /* Стилизация Header */
      [&_.profile-header]:flex [&_.profile-header]:flex-wrap [&_.profile-header]:items-center [&_.profile-header]:gap-[30px] [&_.profile-header]:p-5 [&_.profile-header]:px-10 [&_.profile-header]:bg-bg-block [&_.profile-header]:shrink-0
      [&_.profile-header]:md:flex-col [&_.profile-header]:md:items-start [&_.profile-header]:md:p-5
      
      /* Аватар */
      [&_.profile-avatar]:w-40 [&_.profile-avatar]:h-40 [&_.profile-avatar]:rounded-full [&_.profile-avatar]:object-cover [&_.profile-avatar]:border-[3px] [&_.profile-avatar]:border-black/40 [&_.profile-avatar]:shadow-lg [&_.profile-avatar]:transition-transform [&_.profile-avatar]:duration-300
      [&_.profile-avatar:hover]:scale-105
      [&_.profile-avatar]:md:w-[100px] [&_.profile-avatar]:md:h-[100px]

      /* Кнопки и инпуты профиля */
      [&_.profile-info]:flex [&_.profile-info]:flex-col [&_.profile-info]:gap-0 [&_.profile-info]:text-sm [&_.profile-info]:max-w-[300px]
      [&_.profile-upload]:flex [&_.profile-upload]:flex-col [&_.profile-upload]:gap-2 [&_.profile-upload]:mt-2.5
      [&_.profile-upload-btn]:bg-accent [&_.profile-upload-btn]:text-white [&_.profile-upload-btn]:py-2 [&_.profile-upload-btn]:px-3.5 [&_.profile-upload-btn]:rounded-lg [&_.profile-upload-btn]:font-semibold [&_.profile-upload-btn]:transition-colors [&_.profile-upload-btn]:md:w-full
      [&_.profile-upload-btn:hover]:bg-accent-hover
      [&_.profile-logout-btn]:bg-[#e81123] [&_.profile-logout-btn]:text-white [&_.profile-logout-btn]:py-2 [&_.profile-logout-btn]:px-3.5 [&_.profile-logout-btn]:rounded-lg [&_.profile-logout-btn]:font-bold [&_.profile-logout-btn]:transition-colors [&_.profile-logout-btn]:md:w-full
      [&_.profile-logout-btn:hover]:bg-[#c50f1f]

      /* Друзья */
      [&_.profile-friends-section]:py-2.5 [&_.profile-friends-section]:px-10 [&_.profile-friends-section]:bg-bg-block [&_.profile-friends-section]:flex [&_.profile-friends-section]:flex-col [&_.profile-friends-section]:gap-1.5 [&_.profile-friends-section]:shrink-0 [&_.profile-friends-section]:md:p-5
      [&_.profile-friends-list]:flex [&_.profile-friends-list]:gap-3 [&_.profile-friends-list]:overflow-x-auto [&_.profile-friends-list]:py-2.5 [&_.profile-friends-list]:scrollbar-thin
      [&_.profile-friend-card]:flex-none [&_.profile-friend-card]:w-[180px] [&_.profile-friend-card]:flex [&_.profile-friend-card]:gap-2.5 [&_.profile-friend-card]:items-center [&_.profile-friend-card]:bg-white/5 [&_.profile-friend-card]:p-3 [&_.profile-friend-card]:rounded-xl [&_.profile-friend-card]:md:w-[150px]
      [&_.profile-friend-avatar]:w-12 [&_.profile-friend-avatar]:h-12 [&_.profile-friend-avatar]:rounded-full [&_.profile-friend-avatar]:object-cover

      /* Пароль */
      [&_.profile-password-section]:py-5 [&_.profile-password-section]:px-10 [&_.profile-password-section]:bg-bg-block [&_.profile-password-section]:flex [&_.profile-password-section]:flex-col [&_.profile-password-section]:gap-1.5 [&_.profile-password-section]:shrink-0 [&_.profile-password-section]:md:p-5
      [&_.password-input]:w-full [&_.password-input]:max-w-[400px] [&_.password-input]:bg-white/10 [&_.password-input]:p-2.5 [&_.password-input]:rounded-lg [&_.password-input]:text-white [&_.password-input]:outline-none [&_.password-input]:focus:ring-2 [&_.password-input]:focus:ring-accent
      [&_.password-btn]:bg-accent [&_.password-btn]:text-white [&_.password-btn]:py-2 [&_.password-btn]:px-3.5 [&_.password-btn]:rounded-lg [&_.password-btn]:font-bold [&_.password-btn]:max-w-[200px] [&_.password-btn]:hover:bg-accent-hover [&_.password-btn]:md:w-full [&_.password-btn]:md:max-w-full
    `}>
      <h2 className="text-2xl font-bold text-left p-5 bg-bg-block m-0 shrink-0 md:text-[1.6rem] md:p-5">Мой профиль</h2>

      <ProfileHeader
        currentUser={currentUser}
        handleAvatarChange={handleAvatarChange}
      />

      <ProfileFriendList />

      <ChangePasswordForm />
    </div>
  );
}