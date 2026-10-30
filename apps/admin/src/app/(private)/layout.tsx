import { requireAdminRouteAccess } from "@/lib/admin-guard";
import { FullPageLoading } from "@zoonk/ui/components/loading";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Suspense } from "react";
import { AdminMobileBar } from "./admin-mobile-bar";
import { AppSidebar } from "./app-sidebar";

async function PrivateLayoutContent({ children }: React.PropsWithChildren) {
  const { user } = await requireAdminRouteAccess();
  const account = { email: user.email, image: user.image ?? null, name: user.name };

  return (
    <NuqsAdapter>
      <div className="flex min-h-dvh flex-col lg:flex-row">
        <AppSidebar account={account} />

        <div className="flex min-w-0 flex-1 flex-col">
          <AdminMobileBar account={account} />
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
