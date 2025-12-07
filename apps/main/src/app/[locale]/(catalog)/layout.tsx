"use cache";

import { Header } from "@zoonk/ui/components/header";
import { cacheTagCatalog } from "@zoonk/utils/cache";
import { cacheLife, cacheTag } from "next/cache";
import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { NavbarLinks, NavbarLinksSkeleton } from "@/components/navbar-links";
import { UserAvatarMenu } from "@/components/user-avatar-menu";

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
      <Header>
        <Suspense fallback={<NavbarLinksSkeleton />}>
          <NavbarLinks />
        </Suspense>

        <UserAvatarMenu />
      </Header>

      {children}
    </div>
  );
}
