import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import io, { Socket } from "socket.io-client";
import api from "../services/api"; 

// Определяем типы для контекста
interface SocketContextType {
  socket: Socket | null;
  onlineUsers: number[];
}

const SocketContext = createContext<SocketContextType | null>(null);

export const useSocket = () => {
    const context = useContext(SocketContext);
    return context || { socket: null, onlineUsers: [] };
};

const SOCKET_URL = api.defaults.baseURL || "http://localhost:5000";

export const SocketProvider = ({ children, currentUser }: { children: ReactNode; currentUser: any }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<number[]>([]);

  useEffect(() => {
    // Если пользователя нет, просто сбрасываем сокет (cleanup предыдущего эффекта сам все отключит)
    if (!currentUser) {
      setSocket(null);
      return;
    }

    // Создаем новое подключение
    const newSocket = io(SOCKET_URL, {
        withCredentials: true,
        transports: ["websocket", "polling"], 
    });

    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("🔌 Connected to socket:", newSocket.id);
      // Логика входа в комнату
      console.log("👤 Joining room:", currentUser.id);
      newSocket.emit("join_user_room", currentUser.id);
    });

    newSocket.on("get_online_users", (users: number[]) => {
      setOnlineUsers(users);
    });

    // Cleanup функция: срабатывает перед следующим запуском эффекта (например, смена юзера) 
    // или при размонтировании компонента. Она отключит ИМЕННО ТОТ сокет, который был создан в этом запуске.
    return () => {
      newSocket.disconnect();
    };
  }, [currentUser]); // Зависим только от currentUser

  return (
    <SocketContext.Provider value={{ socket, onlineUsers }}>
      {children}
    </SocketContext.Provider>
  );
};