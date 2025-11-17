import React, { useState, KeyboardEvent } from "react";
import EmojiPicker, { Theme, EmojiClickData } from "emoji-picker-react";
import { useChat } from "../context/ChatContext";
import "../pages/HomePage.css";

export default function MessageInput() {
  const [newMessage, setNewMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const { sendMessage } = useChat();

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim()) return;
    sendMessage(newMessage);
    setNewMessage("");
    setShowEmojiPicker(false);
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setNewMessage((prevMessage) => prevMessage + emojiData.emoji);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      handleSend();
    }
  };

  return (
    <form className="chat-input" onSubmit={handleSend}>
      {showEmojiPicker && (
        <div className="emoji-picker-container">
          <EmojiPicker
            onEmojiClick={onEmojiClick}
            theme={Theme.DARK}
            lazyLoadEmojis={true}
            style={{ width: "100%" }}
            skinTonesDisabled={true}
          />
        </div>
      )}
      <button
        type="button"
        className="emoji-btn"
        onClick={(e) => {
          e.stopPropagation();
          setShowEmojiPicker(!showEmojiPicker);
        }}
      >
        😀
      </button>
      <input
        value={newMessage}
        onChange={(e) => setNewMessage(e.target.value)}
        placeholder="Написать сообщение..."
        onKeyDown={handleKeyDown}
        onClick={() => setShowEmojiPicker(false)}
      />
      <button type="submit">Go</button>
    </form>
  );
}
