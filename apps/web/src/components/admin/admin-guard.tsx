"use client";

import { Spinner } from "@whatsfiled/ui/components/spinner";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useDeferredLoading } from "@/hooks/use-deferred-loading";
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
  const showLoading = useDeferredLoading(isPending);

  const isAdmin = session
    ? adminEmails.includes(session.user.email.toLowerCase())
    : false;

  useEffect(() => {
    // Redirect to home if not signed in or not admin
    if (!isPending && (!session || !isAdmin)) {
      router.replace("/");
    }
  }, [isPending, session, isAdmin, router]);

  // Show loading only after delay (avoids flicker on fast auth checks)
  if (isPending) {
    if (!showLoading) return null;
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  // Redirect in progress - show nothing
  if (!session || !isAdmin) return null;

  return <>{children}</>;
}
