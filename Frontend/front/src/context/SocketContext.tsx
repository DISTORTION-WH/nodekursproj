import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import io, { Socket } from "socket.io-client";
import api from "../services/api";

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
    if (!currentUser) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    if (socket && socket.connected) {
      return;
    }

    console.log("🔄 Initializing socket for user:", currentUser.id);

    const newSocket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnection: true,             
      reconnectionAttempts: 10,
      reconnectionDelay: 3000,
    });

    setSocket(newSocket);

    const joinUserRoom = () => {
      if (currentUser?.id) {
        console.log("👤 Joining user room:", currentUser.id);
        newSocket.emit("join_user_room", currentUser.id);
      }
    };

    newSocket.on("connect", () => {
      console.log("✅ Socket connected:", newSocket.id);
      joinUserRoom();
    });

    newSocket.io.on("reconnect", () => {
      console.log("♻️ Socket reconnected");
      joinUserRoom();
    });

    newSocket.on("get_online_users", (users: number[]) => {
      setOnlineUsers(users);
    });

    return () => {
      newSocket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  return (
    <SocketContext.Provider value={{ socket, onlineUsers }}>
      {children}
    </SocketContext.Provider>
  );
};