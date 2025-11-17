import React, { useState, useEffect } from "react";
import { Socket } from "socket.io-client";
import api from "../services/api";
import { useSocket } from "../context/SocketContext";
import { FriendRequest } from "../types";

interface IncomingRequestsProps {
  onOpenProfile: (id: number) => void;
}

export default function IncomingRequests({ onOpenProfile }: IncomingRequestsProps) {
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  
  const { socket } = useSocket() as { socket: Socket | null };

  const fetchRequests = () => {
    api
      .get<FriendRequest[]>("/friends/incoming")
      .then((res) => setRequests(res.data))
      .catch(console.error);
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on("new_friend_request", fetchRequests);
      return () => {
        socket.off("new_friend_request", fetchRequests);
      };
    }
  }, [socket]);

  const acceptRequest = (id: number) => {
    api
      .post("/friends/accept", { friendId: id })
      .then(() => {
        setRequests((prev) => prev.filter((req) => req.requester_id !== id));
      })
      .catch(console.error);
  };

  return (
    <div className="incoming-section">
      <h3>Входящие</h3>
      {requests.length === 0 ? (
        <p>Нет запросов</p>
      ) : (
        requests.map((req) => (
          <div key={req.requester_id} className="incoming-item">
            <img
              src={
                req.requester_avatar
                  ? api.defaults.baseURL + req.requester_avatar
                  : "/default-avatar.png"
              }
              alt="ava"
              className="avatar"
              onClick={() => onOpenProfile(req.requester_id)}
            />
            <span>{req.requester_name}</span>
            <button onClick={() => acceptRequest(req.requester_id)}>
              Принять
            </button>
          </div>
        ))
      )}
    </div>
  );
}