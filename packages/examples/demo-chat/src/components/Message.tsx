import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, getAvatarColor, getInitials } from "@/lib/utils";
import type { Message as MessageType } from "@/lib/types";

type MessageProps = {
  message: MessageType;
  isOwn: boolean;
};

export function Message({ message, isOwn }: MessageProps) {
  const time = new Date(message.timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={cn("flex gap-3 mb-4", isOwn && "flex-row-reverse")}>
      <Avatar className="h-8 w-8">
        <AvatarFallback className={cn("text-xs", getAvatarColor(message.username))}>
          {getInitials(message.username)}
        </AvatarFallback>
      </Avatar>
      <div className={cn("flex flex-col", isOwn && "items-end")}>
        <div className="flex items-baseline gap-2 mb-1">
          <span className={cn("text-sm font-medium", isOwn && "order-2")}>
            {message.username}
          </span>
          <span className={cn("text-xs text-muted-foreground", isOwn && "order-1")}>
            {time}
          </span>
        </div>
        <div
          className={cn(
            "rounded-lg px-3 py-2 max-w-md break-words",
            isOwn
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          )}
        >
          {message.content}
        </div>
      </div>
    </div>
  );
}

