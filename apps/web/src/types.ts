export type UserStatus = "online" | "away" | "dnd" | "offline";
export type AppTheme = "dark" | "gray" | "light";
export type ChatRole = "owner" | "moderator" | "trusted" | "member";

export interface Friend {
  id: number;
  username: string;
  avatar_url: string | null;
  status?: UserStatus;
}

export interface User {
  id: number;
  username: string;
  email?: string;
  role?: string;
  avatar_url?: string | null;
  avatar_frame?: string | null;
  created_at?: string;
  friends?: User[];
  token?: string;
  is_banned?: boolean;
  status?: UserStatus;
  theme?: AppTheme;
  is_invisible?: boolean;
  bio?: string;
  country?: string;
}

export interface ReactionGroup {
  emoji: string;
  count: number;
  users: number[];
}

export interface ReplyTo {
  id: number;
  text: string;
  sender_name: string;
}

export interface Message {
  id: number;
  text: string;
  chat_id: number;
  sender_id: number;
  created_at: string;
  sender_name?: string;
  sender_avatar?: string | null;
  sender?: {
    id: number;
    username: string;
    avatar_url?: string;
  };
  reply_to_id?: number | null;
  reply_to?: ReplyTo | null;
  reactions?: ReactionGroup[];
  edited_at?: string | null;
  forwarded_from_id?: number | null;
}

export interface UnreadCounts {
  [chatId: number]: number;
}

export interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

export interface ChatParticipant {
  id: number;
  username: string;
  avatar_url?: string | null;
  invited_by_user_id?: number;
  chat_role?: ChatRole;
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

export interface GroupCallParticipant {
  userId: number;
  username: string;
  stream: MediaStream | null;
  audioMuted: boolean;
  videoMuted: boolean;
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
