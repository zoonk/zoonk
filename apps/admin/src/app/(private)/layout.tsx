import { SidebarInset, SidebarProvider } from "@zoonk/ui/components/sidebar";
import { redirect, unauthorized } from "next/navigation";
import { getSession } from "@/lib/user";
import { AppSidebar } from "./app-sidebar";

export default async function PrivateLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const isAdmin = session.user.role === "admin";

  if (!isAdmin) {
    unauthorized();
  }

  return (
    <SidebarProvider>
      <AppSidebar
        closeLabel="Close"
        collapsible="icon"
        description="Admin navigation"
        title="Admin sidebar"
      />

      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
