import { useState, useEffect, useMemo, useRef } from "react";
import { useZocket } from "@zocket/react";
import type { ChatRouter } from "../../shared";
import { Sidebar } from "./Sidebar";
import { ChatView } from "./ChatView";
import { UserList } from "./UserList";
import type { Room, DMConversation, User, Message, ChatType } from "@/lib/types";

type ChatLayoutProps = {
  username: string;
};

export function ChatLayout({ username }: ChatLayoutProps) {
  const { client, useEvent } = useZocket<ChatRouter>();
  const [currentChat, setCurrentChat] = useState<ChatType>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [dmConversations, setDMConversations] = useState<DMConversation[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [roomMessages, setRoomMessages] = useState<Map<string, Message[]>>(new Map());
  const [dmMessages, setDMMessages] = useState<Map<string, Message[]>>(new Map());
  const [typingInRooms, setTypingInRooms] = useState<Map<string, Set<string>>>(new Map());
  const [typingInDMs, setTypingInDMs] = useState<Map<string, Set<string>>>(new Map());
  const hasAutoJoinedRef = useRef(false);

  useEffect(() => {
    client.send.rooms.list({});
    client.send.users.list({});
  }, [client]);

  useEvent(client.on.rooms.onList, (data) => {
    setRooms(data.rooms);
    if (!hasAutoJoinedRef.current) {
      hasAutoJoinedRef.current = true;
      client.send.rooms.join({ roomId: "general" });
    }
  });

  useEvent(client.on.rooms.onJoin, (data) => {
    setRoomMessages((prev) => {
      const updated = new Map(prev);
      updated.set(data.roomId, data.messages);
      return updated;
    });

    setRooms((prev) => {
      const exists = prev.find((r) => r.id === data.roomId);
      if (!exists) {
        return [...prev, { id: data.roomId, memberCount: 1 }];
      }
      return prev;
    });

    if (data.username === username) {
      setCurrentChat({ type: "room", roomId: data.roomId });
    }
  });

  useEvent(client.on.rooms.onUserJoined, (data) => {
    setRooms((prev) =>
      prev.map((r) =>
        r.id === data.roomId ? { ...r, memberCount: r.memberCount + 1 } : r
      )
    );
  });

  useEvent(client.on.rooms.onUserLeft, (data) => {
    setRooms((prev) =>
      prev.map((r) =>
        r.id === data.roomId
          ? { ...r, memberCount: Math.max(0, r.memberCount - 1) }
          : r
      )
    );
  });

  useEvent(client.on.rooms.onMessage, (data) => {
    setRoomMessages((prev) => {
      const updated = new Map(prev);
      const messages = updated.get(data.roomId) || [];
      updated.set(data.roomId, [...messages, data]);
      return updated;
    });

    if (
      currentChat?.type !== "room" ||
      currentChat.roomId !== data.roomId
    ) {
      setRooms((prev) =>
        prev.map((r) =>
          r.id === data.roomId
            ? { ...r, unreadCount: (r.unreadCount || 0) + 1 }
            : r
        )
      );
    }
  });

  useEvent(client.on.dm.onMessage, (data) => {
    const otherUser = data.fromUsername === username ? data.toUsername : data.fromUsername;

    setDMMessages((prev) => {
      const updated = new Map(prev);
      const messages = updated.get(otherUser) || [];
      updated.set(otherUser, [
        ...messages,
        {
          id: data.id,
          username: data.fromUsername,
          content: data.content,
          timestamp: data.timestamp,
        },
      ]);
      return updated;
    });

    setDMConversations((prev) => {
      const exists = prev.find((c) => c.username === otherUser);
      if (!exists) {
        return [
          ...prev,
          {
            username: otherUser,
            messages: [],
            unreadCount: data.fromUsername !== username ? 1 : 0,
          },
        ];
      }

      if (
        currentChat?.type !== "dm" ||
        currentChat.username !== otherUser
      ) {
        return prev.map((c) =>
          c.username === otherUser
            ? { ...c, unreadCount: (c.unreadCount || 0) + 1 }
            : c
        );
      }

      return prev;
    });
  });

  useEvent(client.on.dm.onList, (data) => {
    setDMConversations(data.conversations);
    data.conversations.forEach((conv) => {
      setDMMessages((prev) => {
        const updated = new Map(prev);
        updated.set(conv.username, conv.messages);
        return updated;
      });
    });
  });

  useEvent(client.on.users.onList, (data) => {
    setUsers(data.users);
  });

  useEvent(client.on.users.onUserStatusChanged, (data) => {
    setUsers((prev) => {
      const exists = prev.find((u) => u.username === data.username);
      if (data.status === "offline") {
        return prev.filter((u) => u.username !== data.username);
      }
      if (exists) {
        return prev.map((u) =>
          u.username === data.username ? { ...u, status: data.status } : u
        );
      }
      return [...prev, { username: data.username, status: data.status }];
    });
  });

  useEvent(client.on.typing.onTyping, (data) => {
    if (data.roomId) {
      const roomId = data.roomId;
      setTypingInRooms((prev) => {
        const updated = new Map(prev);
        const typing = new Set(updated.get(roomId) || []);

        if (data.isTyping) {
          typing.add(data.username);
        } else {
          typing.delete(data.username);
        }

        if (typing.size > 0) {
          updated.set(roomId, typing);
        } else {
          updated.delete(roomId);
        }

        return updated;
      });
    } else if (data.dmUsername) {
      const fromUsername = data.username;
      setTypingInDMs((prev) => {
        const updated = new Map(prev);
        const typing = new Set(updated.get(fromUsername) || []);

        if (data.isTyping) {
          typing.add(fromUsername);
        } else {
          typing.delete(fromUsername);
        }

        if (typing.size > 0) {
          updated.set(fromUsername, typing);
        } else {
          updated.delete(fromUsername);
        }

        return updated;
      });
    }
  });

  const handleChatSelect = (chat: ChatType) => {
    setCurrentChat(chat);

    if (chat?.type === "room") {
      setRooms((prev) =>
        prev.map((r) => (r.id === chat.roomId ? { ...r, unreadCount: 0 } : r))
      );
    } else if (chat?.type === "dm") {
      setDMConversations((prev) =>
        prev.map((c) => (c.username === chat.username ? { ...c, unreadCount: 0 } : c))
      );
    }
  };

  const handleJoinRoom = (roomId: string) => {
    client.send.rooms.join({ roomId });
  };

  const handleSendMessage = (content: string) => {
    if (currentChat?.type === "room") {
      client.send.rooms.message({ roomId: currentChat.roomId, content });
    } else if (currentChat?.type === "dm") {
      client.send.dm.send({ toUsername: currentChat.username, content });
    }
  };

  const handleTypingStart = () => {
    if (currentChat?.type === "room") {
      client.send.typing.start({ roomId: currentChat.roomId });
    } else if (currentChat?.type === "dm") {
      client.send.typing.start({ dmUsername: currentChat.username });
    }
  };

  const handleTypingStop = () => {
    if (currentChat?.type === "room") {
      client.send.typing.stop({ roomId: currentChat.roomId });
    } else if (currentChat?.type === "dm") {
      client.send.typing.stop({ dmUsername: currentChat.username });
    }
  };

  const handleUserClick = (clickedUsername: string) => {
    const existingConv = dmConversations.find((c) => c.username === clickedUsername);
    if (!existingConv) {
      client.send.dm.list({});
    }
    setCurrentChat({ type: "dm", username: clickedUsername });
  };

  const currentMessages = useMemo(() => {
    if (currentChat?.type === "room") {
      return roomMessages.get(currentChat.roomId) || [];
    } else if (currentChat?.type === "dm") {
      return dmMessages.get(currentChat.username) || [];
    }
    return [];
  }, [currentChat, roomMessages, dmMessages]);

  const typingUsers = useMemo(() => {
    if (currentChat?.type === "room") {
      const typing = typingInRooms.get(currentChat.roomId);
      return typing ? Array.from(typing).filter((u) => u !== username) : [];
    } else if (currentChat?.type === "dm") {
      const typing = typingInDMs.get(currentChat.username);
      return typing ? Array.from(typing) : [];
    }
    return [];
  }, [currentChat, typingInRooms, typingInDMs, username]);

  return (
    <div className="flex h-screen">
      <Sidebar
        rooms={rooms}
        dmConversations={dmConversations}
        currentChat={currentChat}
        onChatSelect={handleChatSelect}
        onJoinRoom={handleJoinRoom}
        currentUsername={username}
      />
      <ChatView
        currentChat={currentChat}
        messages={currentMessages}
        currentUsername={username}
        onSendMessage={handleSendMessage}
        onTypingStart={handleTypingStart}
        onTypingStop={handleTypingStop}
        typingUsers={typingUsers}
      />
      <UserList
        users={users}
        currentUsername={username}
        onUserClick={handleUserClick}
      />
    </div>
  );
}

