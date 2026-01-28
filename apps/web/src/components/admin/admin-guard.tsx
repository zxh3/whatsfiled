"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/lib/auth-client";

export function AdminGuard({
  children,
  adminEmails,
}: {
  children: React.ReactNode;
  adminEmails: string[];
}) {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  const isAdmin = session
    ? adminEmails.includes(session.user.email.toLowerCase())
    : false;

  useEffect(() => {
    // Redirect to home if not signed in or not admin
    if (!isPending && (!session || !isAdmin)) {
      router.replace("/");
    }
  }, [isPending, session, isAdmin, router]);

  // Show loading state while checking
  if (isPending) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Checking permissions...
      </div>
    );
  }

  // Redirect in progress - show nothing
  if (!session || !isAdmin) return null;

  return <>{children}</>;
}
