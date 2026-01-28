"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@whatsfiled/ui/components/dropdown-menu";
import { LogOut } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { signOut, useSession } from "@/lib/auth-client";
import { SignInButton } from "./sign-in-button";

export function UserMenu() {
  const { data: session, isPending } = useSession();
  const [imageError, setImageError] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Always render the same placeholder during SSR and initial hydration
  // to avoid tree structure differences that cause ID mismatches
  if (!mounted || isPending) {
    return <div className="h-6 w-6 animate-pulse rounded-full bg-muted" />;
  }

  if (!session) {
    return <SignInButton />;
  }

  const user = session.user;
  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user.email[0].toUpperCase();

  const showImage = user.image && !imageError;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-6 w-6 items-center justify-center rounded-full hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-foreground/20"
        aria-label="User menu"
      >
        {showImage ? (
          <Image
            width={24}
            height={24}
            src={user.image ?? ""}
            alt={user.name ?? "User"}
            className="h-6 w-6 rounded-full"
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
            {initials}
          </div>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <div className="px-2 py-1.5">
          <p className="text-xs font-medium">{user.name}</p>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() =>
            signOut({
              fetchOptions: {
                onSuccess: () => {
                  window.location.reload();
                },
              },
            })
          }
        >
          <LogOut className="mr-2 h-3.5 w-3.5" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
