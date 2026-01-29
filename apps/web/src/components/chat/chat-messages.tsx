"use client";

import { Button } from "@whatsfiled/ui/components/button";
import { ChevronDown } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { ChatMessage as ChatMessageType } from "@/hooks/use-chat";
import { ChatMessage } from "./chat-message";

interface ChatMessagesProps {
  messages: ChatMessageType[];
  username: string | null;
  isLoading: boolean;
}

export interface ChatMessagesRef {
  scrollToBottom: () => void;
}

export const ChatMessages = forwardRef<ChatMessagesRef, ChatMessagesProps>(
  function ChatMessages({ messages, username, isLoading }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isAtBottom, setIsAtBottom] = useState(true);

    const scrollToBottom = useCallback(() => {
      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
        setIsAtBottom(true);
      }
    }, []);

    // Expose scrollToBottom to parent
    useImperativeHandle(ref, () => ({ scrollToBottom }), [scrollToBottom]);

    // Track if user has scrolled up
    const handleScroll = () => {
      if (!containerRef.current) return;
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      // Allow 50px tolerance
      const atBottom = scrollHeight - scrollTop - clientHeight < 50;
      setIsAtBottom(atBottom);
    };

    // Auto-scroll to bottom when new messages arrive (only if already at bottom)
    // biome-ignore lint/correctness/useExhaustiveDependencies: we want to trigger on message count change
    useEffect(() => {
      if (isAtBottom && containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
    }, [messages.length]);

    if (isLoading) {
      return (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Loading messages...
        </div>
      );
    }

    if (messages.length === 0) {
      return (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          No messages yet. Start the conversation!
        </div>
      );
    }

    return (
      <div className="relative flex-1 overflow-hidden">
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="h-full space-y-1.5 overflow-y-auto px-2 py-2"
        >
          {messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              isOwn={msg.username === username}
            />
          ))}
        </div>

        {/* Scroll to bottom button */}
        {!isAtBottom && (
          <Button
            size="icon"
            variant="secondary"
            onClick={scrollToBottom}
            className="absolute bottom-2 left-1/2 h-7 w-7 -translate-x-1/2 rounded-full shadow-md"
            aria-label="Scroll to bottom"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  },
);
