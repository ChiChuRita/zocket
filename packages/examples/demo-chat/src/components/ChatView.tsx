import { useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Message } from "./Message";
import { MessageInput } from "./MessageInput";
import type { Message as MessageType, ChatType } from "@/lib/types";
import { Hash, User } from "lucide-react";

type ChatViewProps = {
  currentChat: ChatType;
  messages: MessageType[];
  currentUsername: string;
  onSendMessage: (content: string) => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
  typingUsers: string[];
};

export function ChatView({
  currentChat,
  messages,
  currentUsername,
  onSendMessage,
  onTypingStart,
  onTypingStop,
  typingUsers,
}: ChatViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  useEffect(() => {
    if (shouldAutoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, shouldAutoScroll]);

  useEffect(() => {
    setShouldAutoScroll(true);
  }, [currentChat]);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setShouldAutoScroll(isAtBottom);
    }
  };

  if (!currentChat) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Select a room or conversation to start chatting
      </div>
    );
  }

  const chatTitle =
    currentChat.type === "room"
      ? `# ${currentChat.roomId}`
      : `@ ${currentChat.username}`;

  const chatIcon = currentChat.type === "room" ? Hash : User;
  const ChatIcon = chatIcon;

  return (
    <div className="flex-1 flex flex-col">
      <div className="border-b p-4">
        <div className="flex items-center gap-2">
          <ChatIcon className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{chatTitle}</h2>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="p-4 space-y-1"
          style={{ height: "calc(100vh - 200px)", overflow: "auto" }}
        >
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No messages yet. Start the conversation!
            </div>
          ) : (
            messages.map((msg) => (
              <Message
                key={msg.id}
                message={msg}
                isOwn={msg.username === currentUsername}
              />
            ))
          )}
          {typingUsers.length > 0 && (
            <div className="text-sm text-muted-foreground italic pl-11">
              {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"}{" "}
              typing...
            </div>
          )}
        </div>
      </ScrollArea>

      <MessageInput
        onSend={onSendMessage}
        onTypingStart={onTypingStart}
        onTypingStop={onTypingStop}
        placeholder={`Message ${chatTitle}`}
      />
    </div>
  );
}

