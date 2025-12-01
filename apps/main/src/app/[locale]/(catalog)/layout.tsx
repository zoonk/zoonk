"use cache";

import { cacheTagCatalog } from "@zoonk/utils/cache";
import { cacheLife, cacheTag } from "next/cache";
import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { AppTabBar } from "@/components/app-tab-bar";

export default async function CatalogLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  cacheLife("max");
  cacheTag(locale, cacheTagCatalog());

  return (
    <div className="flex min-h-dvh flex-col">
      {children}

      <Suspense>
        <AppTabBar />
      </Suspense>
    </div>
  );
}
