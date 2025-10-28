import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import HomePage from "./pages/HomePage";
import AdminPage from "./pages/AdminPage";
import ProfilePage from "./pages/ProfilePage";
import UserProfilePage from "./pages/UserProfilePage";
import {jwtDecode} from "jwt-decode";
import axios from "axios";
import "./App.css";

// Базовый URL для всех axios-запросов
axios.defaults.baseURL = "http://localhost:5000";

export default function App() {
  const [isAuth, setIsAuth] = useState(false);
  const [role, setRole] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      if (token.split(".").length !== 3) throw new Error("Invalid token");

      const decoded = jwtDecode(token);
      setIsAuth(true);
      setRole(decoded.role || "USER");

      axios
        .get("/users/me", { headers: { Authorization: `Bearer ${token}` } })
        .then(res => setCurrentUser(res.data))
        .catch(err => {
          console.error("Ошибка получения текущего пользователя:", err);
          localStorage.removeItem("token");
          setIsAuth(false);
          setRole(null);
          setCurrentUser(null);
        })
        .finally(() => setLoading(false));
    } catch (err) {
      console.error("Ошибка токена:", err);
      localStorage.removeItem("token");
      setIsAuth(false);
      setRole(null);
      setCurrentUser(null);
      setLoading(false);
    }
  }, []);

  const handleAvatarChange = async (file) => {
    if (!file) return;
    const token = localStorage.getItem("token");
    if (!token) return;

    const formData = new FormData();
    formData.append("avatar", file);

    try {
      await axios.put("/users/avatar", formData, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
      });
      const res = await axios.get("/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCurrentUser(res.data);
    } catch (err) {
      console.error("Ошибка обновления аватара:", err);
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        setIsAuth(false);
        setRole(null);
        setCurrentUser(null);
      }
    }
  };

  if (loading) return <div style={{ textAlign: "center", marginTop: "50px" }}>Загрузка...</div>;

  return (
    <Router>
      <Navbar isAuth={isAuth} setIsAuth={setIsAuth} role={role} setRole={setRole} currentUser={currentUser} />
      <div className="app-container">
        <div className="main-content">
          <Routes>
            <Route
              path="/"
              element={isAuth ? <HomePage currentUser={currentUser} setCurrentUser={setCurrentUser} /> : <Navigate to="/login" />}
            />
            <Route
              path="/login"
              element={<LoginPage setIsAuth={setIsAuth} setRole={setRole} setCurrentUser={setCurrentUser} />}
            />
            <Route
              path="/register"
              element={<RegisterPage setIsAuth={setIsAuth} setRole={setRole} setCurrentUser={setCurrentUser} />}
            />
            <Route path="/admin" element={isAuth && role === "ADMIN" ? <AdminPage /> : <Navigate to="/" />} />
            <Route
              path="/profile"
              element={isAuth ? <ProfilePage currentUser={currentUser} handleAvatarChange={handleAvatarChange} setIsAuth={setIsAuth} setRole={setRole} /> : <Navigate to="/login" />}
            />
            <Route path="/profile/:userId" element={isAuth ? <UserProfilePage /> : <Navigate to="/login" />} />
            <Route path="*" element={isAuth ? <HomePage currentUser={currentUser} setCurrentUser={setCurrentUser} /> : <Navigate to="/login" />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}
