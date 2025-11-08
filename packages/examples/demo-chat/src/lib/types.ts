export type Message = {
  id: string;
  username: string;
  content: string;
  timestamp: Date;
};

export type Room = {
  id: string;
  memberCount: number;
  unreadCount?: number;
};

export type User = {
  username: string;
  status: "online" | "away" | "offline";
};

export type DMConversation = {
  username: string;
  messages: Message[];
  unreadCount?: number;
};

export type ChatType =
  | { type: "room"; roomId: string }
  | { type: "dm"; username: string }
  | null;
