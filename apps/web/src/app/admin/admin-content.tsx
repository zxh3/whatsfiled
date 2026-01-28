"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@whatsfiled/ui/components/tabs";
import { TooltipProvider } from "@whatsfiled/ui/components/tooltip";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { AdminGuard } from "@/components/admin/admin-guard";
import { BackfillTab } from "@/components/admin/backfill-tab";
import { SyncProgressTab } from "@/components/admin/sync-progress-tab";

type TabValue = "sync" | "backfill";

export function AdminContent({ adminEmails }: { adminEmails: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get("tab");
  const currentTab: TabValue = tabParam === "backfill" ? "backfill" : "sync";

  const handleTabChange = useCallback(
    (value: string | number | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === "sync" || value === null) {
        params.delete("tab");
      } else {
        params.set("tab", String(value));
      }
      const queryString = params.toString();
      router.push(queryString ? `${pathname}?${queryString}` : pathname);
    },
    [router, pathname, searchParams],
  );

  return (
    <TooltipProvider delayDuration={300}>
      <AdminGuard adminEmails={adminEmails}>
        <div>
          <h1 className="text-2xl font-bold">Admin</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pipeline management and sync status
          </p>
        </div>

        <Tabs value={currentTab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="sync">Sync Progress</TabsTrigger>
            <TabsTrigger value="backfill">Backfill</TabsTrigger>
          </TabsList>
          <TabsContent value="sync">
            <SyncProgressTab />
          </TabsContent>
          <TabsContent value="backfill">
            <BackfillTab />
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <footer className="text-center text-xs text-muted-foreground py-4">
          <Link href="/" className="hover:underline">
            &larr; Back to Activity Feed
          </Link>
        </footer>
      </AdminGuard>
    </TooltipProvider>
  );
}
