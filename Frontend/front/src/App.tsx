import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext"; // Важно
import { ChatProvider } from "./context/ChatContext";
import { CallProvider } from "./context/CallContext";

// Страницы
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import HomePage from "./pages/HomePage";
import ProfilePage from "./pages/ProfilePage";
import UserProfilePage from "./pages/UserProfilePage";
import AdminPage from "./pages/AdminPage";

// Компоненты
import Navbar from "./components/Navbar";
import CallOverlay from "./components/CallOverlay"; // Наш глобальный оверлей
import ProtectedRoute from "./components/ProtectedRoute";

import "./App.css";

function AppRoutes() {
  const { token, user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  return (
    // 1. SocketProvider должен быть как можно выше, чтобы сокет жил при смене страниц
    <SocketProvider currentUser={user}>
      {/* 2. CallProvider внутри сокета, чтобы иметь доступ к нему */}
      <CallProvider>
        {/* 3. ChatProvider для данных чата */}
        <ChatProvider currentUser={user}>
          
          {token && <Navbar />}

          <div className="app-container">
            <div className="main-content">
              <Routes>
                {/* Публичные */}
                <Route path="/login" element={!token ? <LoginPage /> : <Navigate to="/" />} />
                <Route path="/register" element={!token ? <RegisterPage /> : <Navigate to="/" />} />

                {/* Защищенные */}
                <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                <Route path="/user/:id" element={<ProtectedRoute><UserProfilePage /></ProtectedRoute>} />
                
                {/* Админка */}
                <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />

                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </div>
          </div>

          {/* ГЛОБАЛЬНЫЙ ОВЕРЛЕЙ ЗВОНКА - БУДЕТ ВИДЕН ВЕЗДЕ */}
          {token && <CallOverlay />}

        </ChatProvider>
      </CallProvider>
    </SocketProvider>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;