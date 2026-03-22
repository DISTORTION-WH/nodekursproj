import axios, { InternalAxiosRequestConfig, AxiosError, AxiosResponse } from 'axios';
import { Report } from '../types'; 

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: { resolve: (token: string) => void; reject: (err: any) => void }[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (token) prom.resolve(token);
    else prom.reject(error);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't try to refresh if the failing request IS the refresh call
      if (originalRequest.url === "/auth/refresh") {
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        window.dispatchEvent(new Event("auth-error"));
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue requests while refresh is in progress
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${token}`;
              }
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await api.post("/auth/refresh", {
          refreshToken: localStorage.getItem("refreshToken"),
        });
        const newToken = res.data.accessToken;
        localStorage.setItem("token", newToken);
        if (res.data.refreshToken) {
          localStorage.setItem("refreshToken", res.data.refreshToken);
        }
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }
        processQueue(null, newToken);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        window.dispatchEvent(new Event("auth-error"));
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);


export const login = (data: any) => api.post('/auth/login', data);
export const register = (data: any) => api.post('/auth/register', data);
export const getProfile = () => api.get('/auth/me'); 

export const getUserChats = () => api.get('/chats');
export const getChatMessages = (chatId: number) => api.get(`/chats/${chatId}/messages`);
export const postMessage = (chatId: number, text: string) => api.post(`/chats/${chatId}/messages`, { text });
export const createGroupChat = (name: string) => api.post('/chats/group', { name });
export const getChatUsers = (chatId: number) => api.get(`/chats/${chatId}/users`);
export const createInviteCode = (chatId: number) => api.post(`/chats/${chatId}/invite-code`);
export const joinWithInviteCode = (inviteCode: string) => api.post('/chats/join', { inviteCode });
export const inviteToGroup = (chatId: number, friendId: number) => api.post(`/chats/${chatId}/invite`, { friendId });

export const findOrCreatePrivateChat = (friendId: number) => api.post('/chats/private', { friendId });

export const getFriends = () => api.get('/friends');
export const getIncomingRequests = () => api.get('/friends/incoming');
export const sendFriendRequest = (friendId: number) => api.post('/friends/request', { friendId });
export const acceptFriendRequest = (friendId: number) => api.post('/friends/accept', { friendId });
export const removeFriend = (friendId: number) => api.post('/friends/remove', { friendId });

export const deleteMessage = (messageId: number) => api.delete(`/chats/messages/${messageId}`);

export const addReaction = (msgId: number, emoji: string) =>
  api.post(`/chats/messages/${msgId}/react`, { emoji });

export const removeReaction = (msgId: number, emoji: string) =>
  api.delete(`/chats/messages/${msgId}/react`, { data: { emoji } });

export const kickUserFromGroup = (chatId: number, userIdToKick: number) =>
    api.post(`/chats/${chatId}/kick`, { userIdToKick });

export const setChatMemberRole = (chatId: number, userId: number, role: string) =>
    api.patch(`/chats/${chatId}/members/${userId}/role`, { role });

export const warnUser = (userId: number, reason: string) => 
    api.post('/moderator/warn', { userId, reason });

export const banUser = (userId: number) => 
    api.post('/moderator/ban', { userId });

export const unbanUser = (userId: number) => 
    api.post('/moderator/unban', { userId });

export const reportMessage = (messageId: number, reason: string) =>
    api.post('/chats/report', { messageId, reason });

export const getReports = () => api.get<Report[]>('/moderator/reports');

export const dismissReport = (reportId: number) => 
    api.post('/moderator/reports/dismiss', { reportId });

export const deleteMessageByMod = (messageId: number, reportId?: number) => 
    api.post('/moderator/delete-message', { messageId, reportId });

export const searchUsers = (query: string) => 
    api.get(`/admin/users/search?q=${query}`);

export const getAllUsers = () => api.get('/admin/users');

export const updateUser = (id: number, data: any) => api.put(`/admin/users/${id}`, data);
export const deleteUser = (id: number) => api.delete(`/admin/users/${id}`);
export const getAllChats = () => api.get('/admin/chats');
export const deleteChat = (id: number) => api.delete(`/admin/chats/${id}`);
export const getStats = () => api.get('/admin/stats');
export const getLogs = () => api.get('/admin/logs');
export const broadcastMessage = (text: string) => api.post('/admin/broadcast', { text });

// Message editing
export const editMessage = (messageId: number, text: string) =>
  api.patch(`/chats/messages/${messageId}`, { text });

// Unread counts
export const getUnreadCounts = () => api.get<{ chat_id: number; unread: number }[]>('/chats/unread');
export const markChatAsRead = (chatId: number) => api.post(`/chats/${chatId}/read`);

// Pinned messages
export const getPinnedMessages = (chatId: number) => api.get(`/chats/${chatId}/pinned`);
export const pinMessage = (msgId: number, chatId: number) =>
  api.post(`/chats/messages/${msgId}/pin`, { chatId });
export const unpinMessage = (msgId: number, chatId: number) =>
  api.delete(`/chats/messages/${msgId}/pin`, { data: { chatId } });

// Search
export const searchMessagesInChat = (chatId: number, query: string) =>
  api.get(`/chats/${chatId}/search?q=${encodeURIComponent(query)}`);

// Forward
export const forwardMessage = (targetChatId: number, text: string, forwardedFromId: number) =>
  api.post(`/chats/${targetChatId}/forward`, { text, forwardedFromId });

// File upload
export const uploadFile = (chatId: number, file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  return api.post(`/chats/${chatId}/upload`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

// Link preview
export const getLinkPreview = (url: string) =>
  api.get(`/chats/preview?url=${encodeURIComponent(url)}`);

// User status, theme, avatar frame, bio & country
export const updateUserStatus = (status: string) => api.patch('/users/me/status', { status });
export const updateUserTheme = (theme: string) => api.patch('/users/me/theme', { theme });
export const updateUserAvatarFrame = (frame: string | null) => api.patch('/users/me/frame', { frame });
export const updateUserBio = (bio: string) => api.patch('/users/me/bio', { bio });
export const updateUserCountry = (country: string) => api.patch('/users/me/country', { country });
export const updateUserUsername = (username: string) => api.patch('/users/me/username', { username });
export const updateProfileBg = (profile_bg: string) => api.patch('/users/me/profile-bg', { profile_bg });
export const updateUsernameStyle = (username_color: string, username_anim: string) =>
  api.patch('/users/me/username-style', { username_color, username_anim });
export const updateProfileExtras = (profile_badge: string, bubble_color: string, social_link: string, accent_color: string) =>
  api.patch('/users/me/profile-extras', { profile_badge, bubble_color, social_link, accent_color });
export const resetProfile = () => api.post('/users/me/reset-profile', {});

// Paginated messages
export const getChatMessagesBefore = (chatId: number, beforeId: number) =>
  api.get(`/chats/${chatId}/messages?before=${beforeId}`);

// Mentions
export const getMentions = () => api.get('/users/me/mentions');

// Media gallery
export const getMediaGallery = (chatId: number) => api.get(`/chats/${chatId}/media`);

// Export chat
export const exportChat = (chatId: number) => api.get(`/chats/${chatId}/export`);

// Polls
export const createPoll = (chatId: number, question: string, options: string[], expires_in_seconds?: number) =>
  api.post(`/chats/${chatId}/polls`, { question, options, expires_in_seconds });

// Scheduled messages
export const createScheduledMessage = (chatId: number, text: string, send_at: string) =>
  api.post(`/chats/${chatId}/scheduled`, { text, send_at });
export const getScheduledMessages = (chatId: number) => api.get(`/chats/${chatId}/scheduled`);
export const deleteScheduledMessage = (chatId: number, msgId: number) =>
  api.delete(`/chats/${chatId}/scheduled/${msgId}`);

export default api;