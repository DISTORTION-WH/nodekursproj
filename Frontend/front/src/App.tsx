import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import AdminPage from "./pages/AdminPage";
import ProfilePage from "./pages/ProfilePage";
import UserProfilePage from "./pages/UserProfilePage";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import { SocketProvider } from "./context/SocketContext";
import { ChatProvider } from "./context/ChatContext";
import { CallProvider } from "./context/CallContext";
import CallOverlay from "./components/CallOverlay";

function AppRoutes() {
  const { isAuth, isLoading, role, currentUser } = useAuth();


  if (isLoading) {
    return <div className="flex items-center justify-center h-screen text-white bg-bg">Загрузка...</div>;
  }

  return (
    <SocketProvider currentUser={currentUser}>
      <CallProvider>
        <ChatProvider currentUser={currentUser}>
          <Navbar />
          <div className="flex h-[calc(100vh-50px)] mt-[50px] overflow-hidden">
            <div className="flex-1 flex overflow-hidden">
              <Routes>
                <Route path="/" element={<HomePage currentUser={currentUser} />} />
                <Route
                  path="/login"
                  element={!isAuth ? <LoginPage /> : <Navigate to="/" />}
                />
                <Route
                  path="/register"
                  element={!isAuth ? <RegisterPage /> : <Navigate to="/" />}
                />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute isAuth={isAuth} role={role} requiredRole="ADMIN">
                      <AdminPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute isAuth={isAuth}>
                      <ProfilePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile/:userId"
                  element={
                    <ProtectedRoute isAuth={isAuth}>
                      <UserProfilePage />
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </div>
          </div>
          <CallOverlay />
        </ChatProvider>
      </CallProvider>
    </SocketProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}