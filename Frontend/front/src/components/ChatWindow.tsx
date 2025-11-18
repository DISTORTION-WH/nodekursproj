import React from "react";
import ChatHeader from "./ChatHeader";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import ChatModals from "./ChatModals";
import { useChat } from "../context/ChatContext";

interface ChatWindowProps {
  isMobile: boolean;
  onCloseChat: () => void;
}

export default function ChatWindow({ isMobile, onCloseChat }: ChatWindowProps) {
  const { currentChat } = useChat(); // Исправлено: activeChat -> currentChat

  if (!currentChat) {
    return null;
  }

  return (
    <>
      <ChatHeader isMobile={isMobile} onCloseChat={onCloseChat} />
      <MessageList />
      <MessageInput />
      <ChatModals />
    </>
  );
}