import { getSession } from "@zoonk/core/users/session/get";
import { FullPageLoading } from "@zoonk/ui/components/loading";
import { SidebarInset, SidebarProvider } from "@zoonk/ui/components/sidebar";
import { redirect, unauthorized } from "next/navigation";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Suspense } from "react";
import { AppSidebar } from "./app-sidebar";

async function PrivateLayoutContent({ children }: React.PropsWithChildren) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const isAdmin = session.user.role === "admin";

  if (!isAdmin) {
    unauthorized();
  }

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
