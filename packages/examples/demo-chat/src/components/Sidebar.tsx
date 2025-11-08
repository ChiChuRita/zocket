import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { cn, getAvatarColor, getInitials } from "@/lib/utils";
import type { Room, DMConversation, ChatType } from "@/lib/types";
import { Hash, Plus, X } from "lucide-react";

type SidebarProps = {
  rooms: Room[];
  dmConversations: DMConversation[];
  currentChat: ChatType;
  onChatSelect: (chat: ChatType) => void;
  onJoinRoom: (roomId: string) => void;
  currentUsername: string;
};

export function Sidebar({
  rooms,
  dmConversations,
  currentChat,
  onChatSelect,
  onJoinRoom,
  currentUsername,
}: SidebarProps) {
  const [showNewRoom, setShowNewRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");

  const handleCreateRoom = () => {
    if (newRoomName.trim()) {
      onJoinRoom(newRoomName.trim().toLowerCase().replace(/\s+/g, "-"));
      setNewRoomName("");
      setShowNewRoom(false);
    }
  };

  const isRoomActive = (roomId: string) =>
    currentChat?.type === "room" && currentChat.roomId === roomId;

  const isDMActive = (username: string) =>
    currentChat?.type === "dm" && currentChat.username === username;

  return (
    <div className="w-64 border-r flex flex-col bg-muted/30">
      <div className="p-4 border-b">
        <div className="flex items-center gap-2 mb-4">
          <Avatar className="h-10 w-10">
            <AvatarFallback className={cn("font-semibold", getAvatarColor(currentUsername))}>
              {getInitials(currentUsername)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{currentUsername}</div>
            <div className="text-xs text-muted-foreground">Online</div>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          <div className="px-2 py-1 flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase">
              Rooms
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="h-5 w-5"
              onClick={() => setShowNewRoom(!showNewRoom)}
            >
              {showNewRoom ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
            </Button>
          </div>

          {showNewRoom && (
            <div className="px-2 py-2">
              <Input
                placeholder="room-name"
                value={newRoomName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewRoomName(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === "Enter") handleCreateRoom();
                  if (e.key === "Escape") setShowNewRoom(false);
                }}
                className="h-8 text-sm"
                autoFocus
              />
            </div>
          )}

          <div className="space-y-1">
            {rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => {
                  onJoinRoom(room.id);
                  onChatSelect({ type: "room", roomId: room.id });
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-2 rounded-md transition-colors text-left",
                  isRoomActive(room.id)
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50"
                )}
              >
                <Hash className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-sm">{room.id}</span>
                {room.unreadCount && room.unreadCount > 0 && (
                  <Badge variant="default" className="h-5 min-w-5 px-1 text-xs">
                    {room.unreadCount > 99 ? "99+" : room.unreadCount}
                  </Badge>
                )}
              </button>
            ))}
          </div>

          <Separator className="my-3" />

          <div className="px-2 py-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase">
              Direct Messages
            </span>
          </div>

          <div className="space-y-1">
            {dmConversations.length === 0 ? (
              <div className="px-2 py-2 text-xs text-muted-foreground text-center">
                No conversations yet
              </div>
            ) : (
              dmConversations.map((conv) => (
                <button
                  key={conv.username}
                  onClick={() => onChatSelect({ type: "dm", username: conv.username })}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-2 rounded-md transition-colors text-left",
                    isDMActive(conv.username)
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/50"
                  )}
                >
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarFallback
                      className={cn("text-xs", getAvatarColor(conv.username))}
                    >
                      {getInitials(conv.username)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate text-sm">{conv.username}</span>
                  {conv.unreadCount && conv.unreadCount > 0 && (
                    <Badge variant="default" className="h-5 min-w-5 px-1 text-xs">
                      {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                    </Badge>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

