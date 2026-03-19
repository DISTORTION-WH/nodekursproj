import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import io, { Socket } from "socket.io-client";
import api from "../services/api";
import { UserStatus } from "../types";
import { useI18n } from "../i18n";

interface SocketContextType {
  socket: Socket | null;
  onlineUsers: number[];
  connected: boolean;
  userStatuses: Record<number, UserStatus>;
}

const SocketContext = createContext<SocketContextType | null>(null);

export const useSocket = () => {
  const context = useContext(SocketContext);
  return context || { socket: null, onlineUsers: [], connected: false, userStatuses: {} };
};

const SOCKET_URL = api.defaults.baseURL || "http://localhost:5000";

export const SocketProvider = ({ children, currentUser }: { children: ReactNode; currentUser: any }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<number[]>([]);
  const [connected, setConnected] = useState(false);
  const [userStatuses, setUserStatuses] = useState<Record<number, UserStatus>>({});
  const notifPermission = useRef(false);
  const { t } = useI18n();

  useEffect(() => {
    if (!currentUser) {
      setSocket(null);
      setConnected(false);
      return;
    }

    // Request notification permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().then((p) => {
        notifPermission.current = p === "granted";
      });
    } else {
      notifPermission.current = Notification.permission === "granted";
    }

    const newSocket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      // Use a function so each reconnection attempt reads the latest token
      // (token may have been refreshed via 401 interceptor since initial connect)
      auth: (cb) => {
        cb({ token: localStorage.getItem("token") });
      },
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("🔌 Connected to socket:", newSocket.id);
      setConnected(true);
      newSocket.emit("join_user_room", currentUser.id);
    });

    newSocket.on("disconnect", () => {
      setConnected(false);
    });

    newSocket.on("connect_error", (err) => {
      console.warn("Socket connection error:", err.message);
      setConnected(false);
    });

    newSocket.on("reconnect", () => {
      console.log("🔄 Socket reconnected");
      setConnected(true);
      newSocket.emit("join_user_room", currentUser.id);
    });

    newSocket.on("get_online_users", (users: number[]) => {
      setOnlineUsers(users);
    });

    // Global new_message handler for browser notifications
    newSocket.on("new_message", (msg: any) => {
      if (!document.hasFocus() && notifPermission.current && msg.sender_id !== currentUser.id) {
        try {
          const notif = new Notification(msg.sender_name || "Новое сообщение", {
            body: msg.text?.length > 100 ? msg.text.slice(0, 100) + "..." : msg.text,
            icon: "/favicon.ico",
          });
          notif.onclick = () => window.focus();
        } catch (e) {
          // Notifications blocked or unavailable
        }
      }
    });

    newSocket.on("user_status_changed", (data: { userId: number; status: UserStatus }) => {
      setUserStatuses((prev) => ({ ...prev, [data.userId]: data.status }));
    });

    return () => {
      newSocket.off("connect");
      newSocket.off("disconnect");
      newSocket.off("connect_error");
      newSocket.off("reconnect");
      newSocket.off("get_online_users");
      newSocket.off("new_message");
      newSocket.off("user_status_changed");
      newSocket.disconnect();
    };
  }, [currentUser]);

  return (
    <SocketContext.Provider value={{ socket, onlineUsers, connected, userStatuses }}>
      {/* Connection lost banner */}
      {currentUser && !connected && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-discord-danger text-white text-sm px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-pulse">
          <span>⚡</span>
          <span>{t.common.no_connection}</span>
        </div>
      )}
      {children}
    </SocketContext.Provider>
  );
};
