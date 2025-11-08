import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, getAvatarColor, getInitials } from "@/lib/utils";
import type { User } from "@/lib/types";
import { Users } from "lucide-react";

type UserListProps = {
  users: User[];
  currentUsername: string;
  onUserClick: (username: string) => void;
};

export function UserList({ users, currentUsername, onUserClick }: UserListProps) {
  const sortedUsers = [...users].sort((a, b) => {
    if (a.username === currentUsername) return -1;
    if (b.username === currentUsername) return 1;
    if (a.status === "online" && b.status !== "online") return -1;
    if (a.status !== "online" && b.status === "online") return 1;
    return a.username.localeCompare(b.username);
  });

  return (
    <div className="w-64 border-l flex flex-col">
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-semibold">Online Users</h2>
          <span className="text-xs text-muted-foreground ml-auto">
            {users.filter((u) => u.status === "online").length}
          </span>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {sortedUsers.map((user) => (
            <button
              key={user.username}
              onClick={() => {
                if (user.username !== currentUsername) {
                  onUserClick(user.username);
                }
              }}
              disabled={user.username === currentUsername}
              className={cn(
                "w-full flex items-center gap-3 p-2 rounded-md transition-colors",
                user.username === currentUsername
                  ? "bg-muted cursor-default"
                  : "hover:bg-accent cursor-pointer"
              )}
            >
              <div className="relative">
                <Avatar className="h-9 w-9">
                  <AvatarFallback
                    className={cn("text-sm", getAvatarColor(user.username))}
                  >
                    {getInitials(user.username)}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={cn(
                    "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background",
                    user.status === "online" ? "bg-green-500" : "bg-yellow-500"
                  )}
                />
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-medium">
                  {user.username}
                  {user.username === currentUsername && (
                    <span className="text-xs text-muted-foreground ml-2">(you)</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground capitalize">
                  {user.status}
                </div>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

