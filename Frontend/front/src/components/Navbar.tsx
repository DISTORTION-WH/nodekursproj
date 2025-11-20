import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getImageUrl } from "../utils/imageUrl";

export default function Navbar() {
  const navigate = useNavigate();
  const { isAuth, role, currentUser, logout } = useAuth();

  const handleLogout = () => {
    logout();
  };

  const navBtnClass = "text-white font-medium no-underline px-3 py-1.5 rounded transition-all duration-200 hover:bg-[#2f3136] hover:scale-105 cursor-pointer border-none bg-transparent text-base";

  return (
    <nav className="fixed top-0 left-0 right-0 h-[50px] bg-bg-block text-white px-5 flex justify-between items-center z-[1000] shadow-md md:px-2.5">
      <Link 
        to="/" 
        className="text-[2.5rem] tracking-[3px] text-white font-logo no-underline md:text-[2rem] md:tracking-[2px]"
      >
        Lume
      </Link>
      
      <div className="flex gap-2.5 flex-wrap items-center">
        {isAuth ? (
          <>
            {role === "ADMIN" && (
              <Link key="admin" to="/admin" className={navBtnClass}>
                Админка
              </Link>
            )}
            {currentUser && (
              <div className="relative inline-block">
                <img
                  src={getImageUrl(currentUser.avatar_url)}
                  alt="avatar"
                  className="w-10 h-10 rounded-full object-cover block cursor-pointer transition-transform duration-200 hover:scale-105 md:w-9 md:h-9"
                  onClick={() => navigate("/profile")}
                />
              </div>
            )}
            <button key="logout" onClick={handleLogout} className={navBtnClass}>
              Выход
            </button>
          </>
        ) : (
          <>
            <Link key="login" to="/login" className={navBtnClass}>
              Вход
            </Link>
            <Link key="register" to="/register" className={navBtnClass}>
              Регистрация
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}