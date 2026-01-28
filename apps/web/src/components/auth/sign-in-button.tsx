"use client";

import { Button } from "@whatsfiled/ui/components/button";
import { signIn } from "@/lib/auth-client";

export function SignInButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() =>
        signIn.social({
          provider: "google",
          callbackURL: window.location.pathname,
        })
      }
    >
      Sign in with Google
    </Button>
  );
}
