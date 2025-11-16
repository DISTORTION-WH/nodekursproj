import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
} from "react";
import { io } from "socket.io-client";
import axios from "axios";

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ currentUser, children }) => {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (currentUser && currentUser.id && token) {
      const newSocket = io(axios.defaults.baseURL);

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

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const value = useMemo(() => ({ socket }), [socket]);

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
};
