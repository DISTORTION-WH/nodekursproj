import React, { useState, KeyboardEvent } from "react";
import EmojiPicker, { Theme, EmojiClickData } from "emoji-picker-react";
import { useChat } from "../context/ChatContext";

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
    setNewMessage((prev) => prev + emojiData.emoji);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      handleSend();
    }
  };

  return (
    <form 
      className="p-4 bg-[#36393f] flex gap-2.5 items-center border-t border-[#202225] relative shrink-0 md:p-2.5" 
      onSubmit={handleSend}
    >
      {showEmojiPicker && (
        <div className="absolute bottom-[70px] left-5 z-50 shadow-xl rounded-lg overflow-hidden">
          <EmojiPicker
            onEmojiClick={onEmojiClick}
            theme={Theme.DARK}
            lazyLoadEmojis={true}
            skinTonesDisabled={true}
          />
        </div>
      )}
      
      <button
        type="button"
        className="bg-transparent border-none text-2xl cursor-pointer grayscale opacity-70 transition-all hover:grayscale-0 hover:opacity-100 hover:scale-110 p-0"
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
        className="flex-1 bg-[#40444b] border-none rounded-lg p-2.5 text-white text-[0.95rem] outline-none transition-colors focus:bg-[#4f545c] placeholder-[#72767d]"
      />
      
      <button 
        type="submit"
        className="bg-transparent border-none text-accent font-bold cursor-pointer px-2.5 transition-colors hover:text-white"
      >
        Go
      </button>
    </form>
  );
}