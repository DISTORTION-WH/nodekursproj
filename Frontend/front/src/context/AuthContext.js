import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import api from "../services/api";

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [isAuth, setIsAuth] = useState(false);
  const [role, setRole] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setIsAuth(false);
    setRole(null);
    setCurrentUser(null);
    navigate("/login");
  }, [navigate]);

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

      api
        .get("/users/me")
        .then((res) => setCurrentUser(res.data))
        .catch((err) => {
          console.error("Ошибка получения текущего пользователя:", err);
          logout();
        })
        .finally(() => setLoading(false));
    } catch (err) {
      console.error("Ошибка токена:", err);
      logout();
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    const handleAuthError = () => {
      logout();
    };
    window.addEventListener("auth-error", handleAuthError);
    return () => {
      window.removeEventListener("auth-error", handleAuthError);
    };
  }, [logout]);

  const login = async (username, password) => {
    try {
      const res = await api.post("/auth/login", { username, password });
      const token = res.data.accessToken;
      localStorage.setItem("token", token);

      const decoded = jwtDecode(token);
      setIsAuth(true);
      setRole(decoded.role || "USER");

      const resUser = await api.get("/users/me");
      setCurrentUser(resUser.data);

      navigate("/");
    } catch (err) {
      console.error(err);
      throw err.response?.data?.message || "Ошибка входа";
    }
  };

  const handleAvatarChange = async (file) => {
    if (!file) return;

    const formData = new FormData();
    formData.append("avatar", file);

    try {
      await api.put("/users/avatar", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      const res = await api.get("/users/me");
      setCurrentUser(res.data);
    } catch (err) {
      console.error("Ошибка обновления аватара:", err);
    }
  };

  const value = {
    isAuth,
    role,
    currentUser,
    loading,
    login,
    logout,
    handleAvatarChange,
    setCurrentUser,
    setIsAuth,
    setRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
