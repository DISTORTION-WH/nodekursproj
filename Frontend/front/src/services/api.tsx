import axios from "axios";

// Определяем URL в зависимости от среды
const API_URL = process.env.NODE_ENV === 'production' 
  ? (process.env.REACT_APP_API_URL || 'https://your-backend-url.onrender.com/api') // ЗАМЕНИТЕ ЭТУ ССЫЛКУ на ваш реальный бэкенд, если он есть. Если нет, оставьте как есть, но работать будет только если бэкенд и фронт на одном домене.
  : "http://localhost:5000/api";

console.log("API Base URL:", API_URL);

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Важно для кук/сессий если используются
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Если 401, диспатчим событие для логаута
      window.dispatchEvent(new Event("auth-error"));
    }
    return Promise.reject(error);
  }
);

export default api;