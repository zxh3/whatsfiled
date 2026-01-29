"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getChatUsername, setChatUsername } from "@/lib/chat-username";
import { supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";

export interface ChatMessage {
  id: string;
  username: string;
  message: string;
  createdAt: Date;
  isOptimistic?: boolean;
}

const MAX_MESSAGES = 1000;

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [username, setUsernameState] = useState<string | null>(null);
  const [isUsernamePromptOpen, setIsUsernamePromptOpen] = useState(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const pendingMessageRef = useRef<string | null>(null);

  // Load username from localStorage on mount
  useEffect(() => {
    setUsernameState(getChatUsername());
  }, []);

  // Fetch initial messages (with polling fallback if realtime fails)
  const { data, isLoading } = trpc.chat.getMessages.useQuery(undefined, {
    refetchOnWindowFocus: false,
    // Poll every 3 seconds as fallback when realtime isn't connected
    refetchInterval: isRealtimeConnected ? false : 3000,
  });

  // Set initial messages
  useEffect(() => {
    if (data?.messages) {
      setMessages(
        data.messages.map((msg) => ({
          id: msg.id,
          username: msg.username,
          message: msg.message,
          createdAt: new Date(msg.createdAt),
        })),
      );
    }
  }, [data]);

  // Subscribe to realtime updates (only if Supabase is configured)
  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel("chat_messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
        },
        (payload) => {
          const newMsg = payload.new as {
            id: string;
            username: string;
            message: string;
            created_at: string;
          };

          setMessages((prev) => {
            // Check if message already exists (e.g., from optimistic update)
            if (prev.some((m) => m.id === newMsg.id)) {
              // Replace optimistic message with real one
              return prev.map((m) =>
                m.id === newMsg.id
                  ? {
                      id: newMsg.id,
                      username: newMsg.username,
                      message: newMsg.message,
                      createdAt: new Date(newMsg.created_at),
                      isOptimistic: false,
                    }
                  : m,
              );
            }

            // Add new message and trim to max
            const updated = [
              ...prev,
              {
                id: newMsg.id,
                username: newMsg.username,
                message: newMsg.message,
                createdAt: new Date(newMsg.created_at),
              },
            ];

            if (updated.length > MAX_MESSAGES) {
              return updated.slice(-MAX_MESSAGES);
            }
            return updated;
          });
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setIsRealtimeConnected(true);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setIsRealtimeConnected(false);
        }
      });

    return () => {
      supabase?.removeChannel(channel);
    };
  }, []);

  const sendMessageMutation = trpc.chat.sendMessage.useMutation();

  const sendMessage = useCallback(
    async (text: string) => {
      const currentUsername = getChatUsername();

      if (!currentUsername) {
        // Store pending message and open prompt
        pendingMessageRef.current = text;
        setIsUsernamePromptOpen(true);
        return;
      }

      // Create optimistic message
      const optimisticId = `optimistic-${Date.now()}`;
      const optimisticMsg: ChatMessage = {
        id: optimisticId,
        username: currentUsername,
        message: text,
        createdAt: new Date(),
        isOptimistic: true,
      };

      setMessages((prev) => {
        const updated = [...prev, optimisticMsg];
        if (updated.length > MAX_MESSAGES) {
          return updated.slice(-MAX_MESSAGES);
        }
        return updated;
      });

      try {
        const result = await sendMessageMutation.mutateAsync({
          username: currentUsername,
          message: text,
        });

        // Replace optimistic message with real one
        setMessages((prev) =>
          prev.map((m) =>
            m.id === optimisticId
              ? {
                  id: result.id,
                  username: result.username,
                  message: result.message,
                  createdAt: new Date(result.createdAt),
                  isOptimistic: false,
                }
              : m,
          ),
        );
      } catch {
        // Remove optimistic message on error
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      }
    },
    [sendMessageMutation],
  );

  const setUsername = useCallback(
    (name: string) => {
      setChatUsername(name);
      setUsernameState(name);
      setIsUsernamePromptOpen(false);

      // Send pending message if any
      if (pendingMessageRef.current) {
        const pending = pendingMessageRef.current;
        pendingMessageRef.current = null;
        sendMessage(pending);
      }
    },
    [sendMessage],
  );

  const closeUsernamePrompt = useCallback(() => {
    setIsUsernamePromptOpen(false);
    pendingMessageRef.current = null;
  }, []);

  return {
    messages,
    username,
    isLoading,
    isSending: sendMessageMutation.isPending,
    sendMessage,
    setUsername,
    isUsernamePromptOpen,
    closeUsernamePrompt,
  };
}
