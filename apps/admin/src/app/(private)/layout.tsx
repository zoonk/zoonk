import { requireAdminRouteAccess } from "@/lib/admin-guard";
import { FullPageLoading } from "@zoonk/ui/components/loading";
import { SidebarInset, SidebarProvider } from "@zoonk/ui/components/sidebar";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Suspense } from "react";
import { AppSidebar } from "./app-sidebar";

async function PrivateLayoutContent({ children }: React.PropsWithChildren) {
  await requireAdminRouteAccess();

  return (
    <NuqsAdapter>
      <SidebarProvider>
        <AppSidebar collapsible="icon" title="Admin sidebar" />

        <SidebarInset>{children}</SidebarInset>
      </SidebarProvider>
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
