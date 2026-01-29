"use client";

import { format } from "date-fns";
import type { ChatMessage as ChatMessageType } from "@/hooks/use-chat";

interface ChatMessageProps {
  message: ChatMessageType;
  isOwn: boolean;
}

export function ChatMessage({ message, isOwn }: ChatMessageProps) {
  // Format as "MM/dd HH:mm" (e.g., "01/28 14:30")
  const timeStr = format(message.createdAt, "MM/dd HH:mm");

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-2.5 py-1.5 ${
          isOwn
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        } ${message.isOptimistic ? "opacity-70" : ""}`}
      >
        <div
          className={`flex items-baseline gap-2 text-[10px] ${
            isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
          }`}
        >
          <span className="font-medium">{message.username}</span>
          <span>{timeStr}</span>
        </div>
        <div className="whitespace-pre-wrap break-words text-sm">
          {message.message}
        </div>
      </div>
    </div>
  );
}
