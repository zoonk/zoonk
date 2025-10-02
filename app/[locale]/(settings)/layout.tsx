"use cache";

import { unstable_cacheLife as cacheLife } from "next/cache";
import { setRequestLocale } from "next-intl/server";
import { SettingsSidebar } from "@/app/[locale]/(settings)/SettingsSidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default async function Layout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  cacheLife("max");
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <SidebarProvider>
      <SettingsSidebar />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
