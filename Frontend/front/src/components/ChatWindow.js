import React from "react";
import ChatHeader from "./ChatHeader";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import ChatModals from "./ChatModals";
import { useChat } from "../context/ChatContext";

export default function ChatWindow({ isMobile, onCloseChat }) {
  const { activeChat } = useChat();

  if (!activeChat) {
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
