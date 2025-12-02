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
import ModeratorPage from "./pages/ModeratorPage";
import ProfilePage from "./pages/ProfilePage";
import UserProfilePage from "./pages/UserProfilePage";
import { SocketProvider } from "./context/SocketContext";
import { ChatProvider } from "./context/ChatContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { CallProvider } from "./context/CallContext";
import CallOverlay from "./components/CallOverlay";
import "./App.css";

function AppRoutes() {
  const { isAuth, currentUser, loading } = useAuth();
  
  if (loading) {
    return (
      <div style={{ textAlign: "center", marginTop: "50px" }}>Загрузка...</div>
    );
  }

  const isAdmin = currentUser?.roles?.includes('ADMIN') || currentUser?.role === 'ADMIN';
  
  const isModerator = currentUser?.roles?.includes('MODERATOR') || currentUser?.role === 'MODERATOR'; 

  return (
    <SocketProvider currentUser={currentUser}>
      <CallProvider>
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
                <Route path="/register" element={<ZFRegisterPage />} />
                
                <Route
                  path="/admin"
                  element={
                    isAuth && isAdmin ? (
                      <AdminPage />
                    ) : (
                      <Navigate to="/" />
                    )
                  }
                />
                
                <Route
                  path="/moderator"
                  element={
                    isAuth && (isAdmin || isModerator) ? (
                      <ModeratorPage />
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