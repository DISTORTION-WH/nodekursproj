import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Navbar from "./components/Navbar";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import HomePage from "./pages/HomePage";
import AdminPage from "./pages/AdminPage";
import ProfilePage from "./pages/ProfilePage";
import UserProfilePage from "./pages/UserProfilePage";
import { SocketProvider } from "./context/SocketContext";
import { ChatProvider } from "./context/ChatContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import "./App.css";

function AppRoutes() {
  const { isAuth, role, currentUser, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ textAlign: "center", marginTop: "50px" }}>Загрузка...</div>
    );
  }

  return (
    <SocketProvider currentUser={currentUser}>
      <ChatProvider currentUser={currentUser}>
        <Navbar />
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
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
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
      </ChatProvider>
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
