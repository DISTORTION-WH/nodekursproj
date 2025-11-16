import React, { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import axios from "axios";

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ currentUser, children }) => {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (currentUser && currentUser.id && token && !socket) {
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
        setSocket(null);
      };
    } else if (!currentUser && socket) {
      socket.disconnect();
      setSocket(null);
    }
  }, [currentUser, socket]);

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
};
