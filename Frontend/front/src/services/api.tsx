import axios, {
  InternalAxiosRequestConfig,
  AxiosResponse,
  AxiosError,
} from "axios";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:5000",
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem("token");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      window.dispatchEvent(new Event("auth-error"));
    }
    return Promise.reject(error);
  }
);

export const adminApi = {
  broadcastMessage: async (text: string) => {
    const response = await api.post("/admin/broadcast", { text });
    return response.data;
  },
  
  getStats: () => api.get("/admin/stats"),
  getLogs: () => api.get("/admin/logs"),
};

export default api;