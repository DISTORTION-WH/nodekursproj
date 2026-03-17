import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import Navbar from "./components/Navbar";
import LoginPage from "./pages/LoginPage";
import ZFRegisterPage from "./pages/RegisterPage";
import HomePage from "./pages/HomePage";
import AdminPage from "./pages/AdminPage";
import ModeratorPage from "./pages/ModeratorPage";
import ProfilePage from "./pages/ProfilePage";
import CallHistoryPage from "./pages/CallHistoryPage";
import UserProfilePage from "./pages/UserProfilePage";
import { SocketProvider } from "./context/SocketContext";
import { ChatProvider } from "./context/ChatContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { CallProvider } from "./context/CallContext";
import CallOverlay from "./components/CallOverlay";
import "./index.css";

function AppRoutes() {
  const { isAuth, currentUser, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-discord-bg text-discord-text-primary">
        Загрузка...
      </div>
    );
  }

  const isAdmin = currentUser?.role === "ADMIN";
  const isModerator = currentUser?.role === "MODERATOR";
  const isAuthPage = location.pathname === "/login" || location.pathname === "/register";

  return (
    <SocketProvider currentUser={currentUser}>
      <CallProvider>
        <ChatProvider currentUser={currentUser}>
          <div className="flex flex-col h-screen bg-discord-bg text-discord-text-primary">
            {!isAuthPage && <Navbar />}
            <div className={`flex flex-1 ${isAuthPage ? "" : "overflow-hidden mt-[50px]"}`}>
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
                  path="/calls"
                  element={isAuth ? <CallHistoryPage /> : <Navigate to="/login" />}
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
