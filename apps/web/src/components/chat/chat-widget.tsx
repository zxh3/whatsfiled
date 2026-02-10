"use client";

import { Button } from "@whatsfiled/ui/components/button";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, X } from "lucide-react";
import { useRef, useState } from "react";
import { useChat } from "@/hooks/use-chat";
import { ChatInput } from "./chat-input";
import { ChatMessages, type ChatMessagesRef } from "./chat-messages";
import { UsernamePrompt } from "./username-prompt";

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const chatMessagesRef = useRef<ChatMessagesRef>(null);

  const {
    messages,
    username,
    isLoading,
    isSending,
    sendMessage,
    setUsername,
    isUsernamePromptOpen,
    closeUsernamePrompt,
  } = useChat({ enabled: isOpen });

  const handleSend = (text: string) => {
    sendMessage(text);
    chatMessagesRef.current?.scrollToBottom();
  };

  return (
    <>
      {/* Chat button (visible when closed) */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed right-4 bottom-4 z-50"
          >
            <Button
              onClick={() => setIsOpen(true)}
              size="icon-lg"
              className="h-12 w-12 rounded-full shadow-lg"
              aria-label="Open chat"
            >
              <MessageCircle className="h-5 w-5" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed right-4 bottom-4 z-50 flex h-[520px] w-[340px] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xl sm:w-[400px]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-3">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Chat</span>
                {username && (
                  <span className="text-xs text-muted-foreground">
                    as {username}
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setIsOpen(false)}
                aria-label="Close chat"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Content */}
            <ChatMessages
              ref={chatMessagesRef}
              messages={messages}
              username={username}
              isLoading={isLoading}
            />
            <ChatInput onSend={handleSend} disabled={isSending} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Username prompt dialog */}
      <UsernamePrompt
        open={isUsernamePromptOpen}
        onOpenChange={(open) => !open && closeUsernamePrompt()}
        onSubmit={setUsername}
      />
    </>
  );
}
