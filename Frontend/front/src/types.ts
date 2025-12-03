export interface Friend {
  id: number;
  username: string;
  avatar_url: string | null;
}

export interface User {
  id: number;
  username: string;
  email?: string;
  role?: string; 
  roles?: string[]; 
  avatar_url?: string | null;
  created_at?: string;
  friends?: User[];
  token?: string;
  is_banned?: boolean;
}

export interface Message {
  id: number;
  text: string;
  chat_id: number;
  sender_id: number;
  created_at: string;
  sender_name?: string;
  sender?: {
    id: number;
    username: string;
    avatar_url?: string;
  };
}

export interface ChatParticipant {
  id: number;
  username: string;
  avatar_url?: string | null;
  invited_by_user_id?: number;
  roles?: string[];
}

export interface Chat {
  id: number;
  name: string | null;
  is_group: boolean;
  creator_id?: number;
  invite_code?: string;
  username?: string;
  avatar_url?: string;
  last_message?: {
    text: string;
    created_at: string;
  };
  participants?: User[];
  messages?: Message[];
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface FriendRequest {
  requester_id: number;
  requester_name: string;
  requester_avatar: string | null;
}

export interface LogEntry {
  id: number;
  level: string;
  message: string;
  meta: any;
  created_at: string;
}

export interface AppStats {
  usersCount: number;
  chatsCount: number;
  messagesCount: number;
  logsCount: number;
}

export interface Report {
  id: number;
  reason: string;
  status: string;
  created_at: string;
  message_id: number;
  message_text: string;
  sender_id: number;
  sender_name: string;
  reporter_name: string;
}