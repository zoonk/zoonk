"use cache";

import { SidebarInset, SidebarProvider } from "@zoonk/ui/components/sidebar";
import { cacheTagSettings } from "@zoonk/utils/cache";
import { cacheLife, cacheTag } from "next/cache";
import { setRequestLocale } from "next-intl/server";
import { SettingsSidebar } from "@/app/[locale]/(settings)/settings-sidebar";

export default async function Layout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  cacheLife("max");
  cacheTag(locale, cacheTagSettings());

  return (
    <SidebarProvider>
      <SettingsSidebar />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
