import React, { useState, useEffect } from "react";
import { Socket } from "socket.io-client";
import api from "../services/api";
import { useSocket } from "../context/SocketContext";
import { FriendRequest } from "../types";
import { getImageUrl } from "../utils/imageUrl";

interface IncomingRequestsProps {
  onOpenProfile: (id: number) => void;
}

export default function IncomingRequests({ onOpenProfile }: IncomingRequestsProps) {
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const { socket } = useSocket() as { socket: Socket | null };

  const fetchRequests = () => {
    api.get<FriendRequest[]>("/friends/incoming")
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
    api.post("/friends/accept", { friendId: id })
      .then(() => {
        setRequests((prev) => prev.filter((req) => req.requester_id !== id));
      })
      .catch(console.error);
  };

  if (requests.length === 0) return null;

  return (
    <div className="mb-4">
      <h3 className="text-[#b9bbbe] text-xs font-bold uppercase mb-2">Входящие</h3>
      {requests.map((req) => (
        <div key={req.requester_id} className="flex items-center justify-between p-2 rounded hover:bg-[#36393f] group">
          <div className="flex items-center gap-2 overflow-hidden">
             <img
              src={getImageUrl(req.requester_avatar)}
              alt="ava"
              className="w-6 h-6 rounded-full object-cover cursor-pointer"
              onClick={() => onOpenProfile(req.requester_id)}
            />
            <span className="text-[#dcddde] text-sm truncate">{req.requester_name}</span>
          </div>
          <button 
            onClick={() => acceptRequest(req.requester_id)}
            className="bg-success text-white border-none py-1 px-2 rounded text-xs cursor-pointer hover:bg-[#3ba55d]"
          >
            Принять
          </button>
        </div>
      ))}
    </div>
  );
}