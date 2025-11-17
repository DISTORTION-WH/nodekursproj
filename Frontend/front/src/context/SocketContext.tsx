import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  ReactNode,
} from "react";
import { io, Socket } from "socket.io-client";
import api from "../services/api";
import { User } from "../types";

interface SocketContextType {
  socket: Socket | null;
}


const SocketContext = createContext<SocketContextType>({ socket: null });

export const useSocket = () => useContext(SocketContext);

interface SocketProviderProps {
  currentUser: User | null;
  children: ReactNode;
}

export const SocketProvider = ({
  currentUser,
  children,
}: SocketProviderProps) => {

  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (currentUser && currentUser.id && token) {
      const newSocket = io(api.defaults.baseURL || "", {
 
      });

      newSocket.on("connect", () => {
        newSocket.emit("join_user_room", currentUser.id);
        console.log(
          `Socket: Подключен и вошел в комнату user_${currentUser.id}`
        );
      });

      setSocket(newSocket);

      return () => {
        console.log("Socket: Отключение...");
        newSocket.disconnect();
      };
    } else {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
    }
    // eslint-disable-next-line
  }, [currentUser]); 

  const value = useMemo(() => ({ socket }), [socket]);

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
};