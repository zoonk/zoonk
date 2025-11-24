"use cache";

import { cacheTagSettings } from "@zoonk/utils/cache";
import { cacheLife, cacheTag } from "next/cache";
import { setRequestLocale } from "next-intl/server";
import { SettingsNavbar } from "@/app/[locale]/(settings)/settings-navbar";

export default async function Layout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  cacheLife("max");
  cacheTag(locale, cacheTagSettings());

  return (
    <div className="flex min-h-dvh flex-col">
      <SettingsNavbar />
      {children}
    </div>
  );
}
