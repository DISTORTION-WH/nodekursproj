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
      return () => { socket.off("new_friend_request", fetchRequests); };
    }
  }, [socket]);

  const acceptRequest = (id: number) => {
    api
      .post("/friends/accept", { friendId: id })
      .then(() => setRequests((prev) => prev.filter((r) => r.requester_id !== id)))
      .catch(console.error);
  };

  if (requests.length === 0) return null;

  return (
    <div className="px-2 mb-2">
      <div className="flex items-center px-2 py-2">
        <span className="text-discord-text-muted text-xs uppercase font-semibold tracking-wide">
          Входящие ({requests.length})
        </span>
      </div>

      {requests.map((req) => (
        <div key={req.requester_id} className="flex items-center gap-2 px-2 py-1.5 rounded">
          <img
            src={getImageUrl(req.requester_avatar)}
            alt={req.requester_name}
            className="w-8 h-8 rounded-full object-cover cursor-pointer shrink-0"
            onClick={() => onOpenProfile(req.requester_id)}
          />
          <span
            className="text-discord-text-secondary text-sm flex-1 truncate cursor-pointer hover:text-white"
            onClick={() => onOpenProfile(req.requester_id)}
          >
            {req.requester_name}
          </span>
          <button
            className="text-xs bg-discord-success hover:bg-discord-success-hover text-white px-2 py-0.5 rounded transition shrink-0"
            onClick={() => acceptRequest(req.requester_id)}
          >
            ✓
          </button>
        </div>
      ))}
    </div>
  );
}
