// src/components/IncomingRequests.js
import React from "react";
import axios from "axios";

export default function IncomingRequests({
  requests,
  onAccept,
  onOpenProfile,
}) {
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
                  ? axios.defaults.baseURL + req.requester_avatar
                  : "/default-avatar.png"
              }
              alt="ava"
              className="avatar"
              onClick={() => onOpenProfile(req.requester_id)}
            />
            <span>{req.requester_name}</span>
            <button onClick={() => onAccept(req.requester_id)}>Принять</button>
          </div>
        ))
      )}
    </div>
  );
}
