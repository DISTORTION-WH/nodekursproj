import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode
} from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import api from "../services/api";
import { User } from "../types";

interface AuthContextType {
  isAuth: boolean;
  role: string | null;
  currentUser: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  handleAvatarChange: (file: File) => Promise<void>;
  setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
  setIsAuth: React.Dispatch<React.SetStateAction<boolean>>;
  setRole: React.Dispatch<React.SetStateAction<string | null>>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

interface JwtPayload {
  id: number;
  role: string;
  exp: number;
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuth, setIsAuth] = useState<boolean>(false);
  const [role, setRole] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
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

      const decoded = jwtDecode<JwtPayload>(token);
      setIsAuth(true);
      setRole(decoded.role || "USER");

      api
        .get<User>("/users/me")
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

  const login = async (username: string, password: string) => {
    try {
      const res = await api.post("/auth/login", { username, password });
      const token = res.data.accessToken;
      localStorage.setItem("token", token);

      const decoded = jwtDecode<JwtPayload>(token);
      setIsAuth(true);
      setRole(decoded.role || "USER");

      const resUser = await api.get<User>("/users/me");
      setCurrentUser(resUser.data);

      navigate("/");
    } catch (err: any) {
      console.error(err);
      throw err.response?.data?.message || "Ошибка входа";
    }
  };

  const handleAvatarChange = async (file: File) => {
    if (!file) return;

    const formData = new FormData();
    formData.append("avatar", file);

    try {
      await api.put("/users/avatar", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      const res = await api.get<User>("/users/me");
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