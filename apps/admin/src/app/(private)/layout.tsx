import { type InboxQueueName } from "@/data/inbox/get-inbox";
import { requireAdminRouteAccess } from "@/lib/admin-guard";
import { FullPageLoading } from "@zoonk/ui/components/loading";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Suspense } from "react";
import { AdminCommandPalette } from "./admin-command-palette";
import { AdminMobileMenu } from "./admin-mobile-menu";
import { AppSidebar } from "./app-sidebar";
import { InboxCount } from "./inbox-count";

function count(queue: InboxQueueName) {
  return (
    <Suspense fallback={null}>
      <InboxCount queue={queue} />
    </Suspense>
  );
}

async function PrivateLayoutContent({ children }: React.PropsWithChildren) {
  const { user } = await requireAdminRouteAccess();
  const account = { email: user.email, image: user.image ?? null, name: user.name };

  const counts = {
    accountDeletions: count("accountDeletions"),
    contentFixes: count("contentFixes"),
    feedback: count("feedback"),
    sourceChanges: count("sourceChanges"),
  };

  return (
    <NuqsAdapter>
      <AdminCommandPalette />
      <div className="flex min-h-dvh flex-col lg:flex-row">
        <AppSidebar account={account} counts={counts} />

        <div className="flex min-w-0 flex-1 flex-col">
          <AdminMobileMenu account={account} counts={counts} />
          {children}
        </div>
      </div>
    </NuqsAdapter>
  );
}

export default function PrivateLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<FullPageLoading />}>
      <PrivateLayoutContent>{children}</PrivateLayoutContent>
    </Suspense>
  );
}
