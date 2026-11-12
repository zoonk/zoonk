import { type InboxQueueName } from "@/data/inbox/get-inbox";
import { requireAdminRouteAccess } from "@/lib/admin-guard";
import { FullPageLoading } from "@zoonk/ui/components/loading";
import { cookies } from "next/headers";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Suspense } from "react";
import { AdminCommandPalette } from "./admin-command-palette";
import { AdminMobileBar } from "./admin-mobile-bar";
import { AppSidebar } from "./app-sidebar";
import { InboxCount, InboxTotal } from "./inbox-count";
import { ShortNavTabs } from "./short-nav-tabs";

function count(queue: InboxQueueName) {
  return (
    <Suspense fallback={null}>
      <InboxCount queue={queue} />
    </Suspense>
  );
}

async function PrivateLayoutContent({ children }: React.PropsWithChildren) {
  const { user } = await requireAdminRouteAccess();
  // Review pack only: the sidebar decision's second option, switched on by a cookie.
  const short = (await cookies()).get("adm-nav")?.value === "short";
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
        <AppSidebar
          account={account}
          counts={counts}
          inboxTotal={
            <Suspense fallback={null}>
              <InboxTotal />
            </Suspense>
          }
          short={short}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <AdminMobileBar account={account} counts={counts} />
          {short ? <ShortNavTabs counts={counts} /> : null}
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
