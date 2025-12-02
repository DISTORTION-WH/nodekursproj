import axios, { InternalAxiosRequestConfig, AxiosError, AxiosResponse } from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_URL,
  // УБРАНО: withCredentials: true (Не нужно для Bearer токенов)
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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

export const kickUserFromGroup = (chatId: number, userIdToKick: number) => 
    api.post(`/chats/${chatId}/kick`, { userIdToKick });

export const warnUser = (userId: number, reason: string) => 
    api.post('/moderator/warn', { userId, reason });

export const banUser = (userId: number) => 
    api.post('/moderator/ban', { userId });

export const unbanUser = (userId: number) => 
    api.post('/moderator/unban', { userId });

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

export default api;