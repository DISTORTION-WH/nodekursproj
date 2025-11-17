
export interface User {
  id: number;
  username: string;
  email?: string;
  role?: string;
  avatar_url?: string | null;
  created_at?: string;
  friends?: User[];
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
  };
}

export interface ChatParticipant {
  id: number;
  username: string;
  avatar_url?: string | null;
  invited_by_user_id?: number;
}

export interface Chat {
  id: number;
  name: string | null;
  is_group: boolean;
  creator_id?: number | null;
  invite_code?: string | null;
  participants?: ChatParticipant[];
  messages?: Message[];
  username?: string; 
  avatar_url?: string | null;
}

export interface FriendRequest {
  requester_id: number;
  requester_name: string;
  requester_avatar: string | null;
}