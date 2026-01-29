"use client";

import { Button } from "@whatsfiled/ui/components/button";
import { Send } from "lucide-react";
import {
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

const MAX_LENGTH = 200;
const MIN_HEIGHT = 40; // Must match button height (h-10 = 40px)
const MAX_HEIGHT = 80;

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevDisabledRef = useRef(disabled);

  // Focus textarea when transitioning from disabled to enabled (after send completes)
  useEffect(() => {
    if (prevDisabledRef.current && !disabled) {
      textareaRef.current?.focus();
    }
    prevDisabledRef.current = disabled;
  }, [disabled]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
    // Reset textarea height (focus is restored by useEffect when sending completes)
    if (textareaRef.current) {
      textareaRef.current.style.height = `${MIN_HEIGHT}px`;
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter, but allow Shift+Enter for newlines
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as FormEvent);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= MAX_LENGTH) {
      setText(value);
      // Auto-grow textarea (set to min first to measure, never collapse below min)
      if (textareaRef.current) {
        textareaRef.current.style.height = `${MIN_HEIGHT}px`;
        if (textareaRef.current.scrollHeight > MIN_HEIGHT) {
          textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, MAX_HEIGHT)}px`;
        }
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-border px-2 py-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 flex justify-center">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={disabled}
            rows={1}
            className="w-full resize-none rounded-md border border-border bg-background px-3 py-1.5 pr-12 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:opacity-50"
            style={{ height: MIN_HEIGHT, maxHeight: MAX_HEIGHT }}
          />
          <span
            className={`pointer-events-none absolute right-2 bottom-1.5 text-[10px] text-muted-foreground transition-opacity ${
              text.length > 0 ? "opacity-100" : "opacity-0"
            }`}
          >
            {text.length}/{MAX_LENGTH}
          </span>
        </div>
        <Button
          type="submit"
          size="icon"
          disabled={!text.trim() || disabled}
          aria-label="Send message"
          className="h-10 w-10 shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}
