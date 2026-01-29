"use client";

import { Button } from "@whatsfiled/ui/components/button";
import { Star } from "lucide-react";
import { signIn, useSession } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";

interface WatchButtonProps {
  companyId: string;
}

export function WatchButton({ companyId }: WatchButtonProps) {
  const { data: session, isPending: sessionPending } = useSession();
  const utils = trpc.useUtils();

  const { data: watchStatus, isLoading: watchStatusLoading } =
    trpc.watchlist.isWatching.useQuery(
      { companyId },
      { enabled: !!session && !!companyId },
    );

  const addMutation = trpc.watchlist.add.useMutation({
    onMutate: async () => {
      // Cancel outgoing queries
      await utils.watchlist.isWatching.cancel({ companyId });
      // Snapshot current value
      const previous = utils.watchlist.isWatching.getData({ companyId });
      // Optimistically update
      utils.watchlist.isWatching.setData({ companyId }, { isWatching: true });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previous) {
        utils.watchlist.isWatching.setData({ companyId }, context.previous);
      }
    },
    onSettled: () => {
      // Invalidate to refetch
      utils.watchlist.isWatching.invalidate({ companyId });
      utils.watchlist.list.invalidate();
    },
  });

  const removeMutation = trpc.watchlist.remove.useMutation({
    onMutate: async () => {
      await utils.watchlist.isWatching.cancel({ companyId });
      const previous = utils.watchlist.isWatching.getData({ companyId });
      utils.watchlist.isWatching.setData({ companyId }, { isWatching: false });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        utils.watchlist.isWatching.setData({ companyId }, context.previous);
      }
    },
    onSettled: () => {
      utils.watchlist.isWatching.invalidate({ companyId });
      utils.watchlist.list.invalidate();
    },
  });

  const isWatching = watchStatus?.isWatching ?? false;
  const isLoading =
    sessionPending ||
    watchStatusLoading ||
    addMutation.isPending ||
    removeMutation.isPending;

  const handleClick = () => {
    if (!session) {
      // Redirect to sign in, then back to current page
      signIn.social({
        provider: "google",
        callbackURL: window.location.pathname,
      });
      return;
    }

    if (isWatching) {
      removeMutation.mutate({ companyId });
    } else {
      addMutation.mutate({ companyId });
    }
  };

  // Show loading placeholder during SSR/hydration
  if (sessionPending) {
    return (
      <Button variant="ghost" size="icon-sm" disabled>
        <Star className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={handleClick}
      disabled={isLoading}
      aria-label={isWatching ? "Remove from watchlist" : "Add to watchlist"}
      title={
        !session
          ? "Sign in to watch"
          : isWatching
            ? "Remove from watchlist"
            : "Add to watchlist"
      }
    >
      <Star
        className={`h-4 w-4 transition-colors ${
          isWatching
            ? "fill-yellow-400 text-yellow-400"
            : "text-muted-foreground hover:text-foreground"
        }`}
      />
    </Button>
  );
}
