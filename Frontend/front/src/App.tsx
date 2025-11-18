import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Navbar from "./components/Navbar";
import LoginPage from "./pages/LoginPage";
import ZFRegisterPage from "./pages/RegisterPage";
import HomePage from "./pages/HomePage";
import AdminPage from "./pages/AdminPage";
import ProfilePage from "./pages/ProfilePage";
import UserProfilePage from "./pages/UserProfilePage";
import { SocketProvider } from "./context/SocketContext";
import { ChatProvider } from "./context/ChatContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { CallProvider } from "./context/CallContext";
import CallOverlay from "./components/CallOverlay";
import "./App.css";

function AppRoutes() {
  // ИСПРАВЛЕНО: Используем имена, которые реально есть в AuthContext.tsx
  const { isAuth, role, currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ textAlign: "center", marginTop: "50px" }}>Загрузка...</div>
    );
  }

  return (
    // currentUser передаем напрямую, так как он теперь доступен
    <SocketProvider currentUser={currentUser}>
      <CallProvider>
        <ChatProvider currentUser={currentUser}>
          {isAuth && <Navbar />} {/* Navbar показываем только если авторизован */}
          
          <div className="app-container">
            <div className="main-content">
              <Routes>
                <Route
                  path="/"
                  element={
                    isAuth ? (
                      <HomePage currentUser={currentUser} />
                    ) : (
                      <Navigate to="/login" />
                    )
                  }
                />
                <Route 
                  path="/login" 
                  element={!isAuth ? <LoginPage /> : <Navigate to="/" />} 
                />
                <Route 
                  path="/register" 
                  element={!isAuth ? <ZFRegisterPage /> : <Navigate to="/" />} 
                />
                
                {/* Админский роут */}
                <Route
                  path="/admin"
                  element={
                    isAuth && role === "ADMIN" ? (
                      <AdminPage />
                    ) : (
                      <Navigate to="/" />
                    )
                  }
                />

                <Route
                  path="/profile"
                  element={isAuth ? <ProfilePage /> : <Navigate to="/login" />}
                />
                
                <Route
                  path="/profile/:userId"
                  element={
                    isAuth ? <UserProfilePage /> : <Navigate to="/login" />
                  }
                />

                {/* Ловушка для несуществующих страниц */}
                <Route
                  path="*"
                  element={
                    isAuth ? (
                      <HomePage currentUser={currentUser} />
                    ) : (
                      <Navigate to="/login" />
                    )
                  }
                />
              </Routes>
            </div>
          </div>
          
          {/* Глобальная плашка звонка (вне Routes) */}
          <CallOverlay /> 

        </ChatProvider>
      </CallProvider>
    </SocketProvider>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}