"use cache";

import { cacheTagCatalog } from "@zoonk/utils/cache";
import { cacheLife, cacheTag } from "next/cache";
import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { CatalogTabBar } from "./catalog-tab-bar";

export default async function CatalogLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  cacheLife("max");
  cacheTag(locale, cacheTagCatalog());

  return (
    <div className="flex min-h-dvh flex-col pb-24">
      {children}

      <Suspense>
        <CatalogTabBar />
      </Suspense>
    </div>
  );
}
