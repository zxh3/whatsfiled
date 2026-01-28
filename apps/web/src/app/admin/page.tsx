import { Spinner } from "@whatsfiled/ui/components/spinner";
import { Suspense } from "react";
import { SiteHeader } from "@/components/layout/site-header";
import { AdminContent } from "./admin-content";

export default function AdminPage() {
  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return (
    <main className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        <Suspense
          fallback={
            <div className="flex justify-center py-12">
              <Spinner size="lg" />
            </div>
          }
        >
          <AdminContent adminEmails={adminEmails} />
        </Suspense>
      </div>
    </main>
  );
}
