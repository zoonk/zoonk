"use cache";

import { SidebarInset, SidebarProvider } from "@zoonk/ui/components/sidebar";
import {
  unstable_cacheLife as cacheLife,
  unstable_cacheTag as cacheTag,
} from "next/cache";
import { setRequestLocale } from "next-intl/server";
import { SettingsSidebar } from "@/app/[locale]/(settings)/settings-sidebar";

export default async function Layout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  cacheLife("max");
  cacheTag("settings-layout");
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <SidebarProvider>
      <SettingsSidebar />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
