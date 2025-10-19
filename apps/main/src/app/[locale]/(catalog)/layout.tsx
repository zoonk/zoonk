"use cache";

import { cacheLife, cacheTag } from "next/cache";
import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { NavbarLinks } from "@/components/navbar-links";
import { UserAvatarMenu } from "@/components/user-avatar-menu";

export default async function CatalogLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  cacheLife("max");
  cacheTag(locale, "catalog");

  return (
    <Suspense>
      <div className="flex min-h-dvh flex-col">
        <nav className="flex w-full items-center justify-between gap-2 p-4">
          <NavbarLinks />
          <UserAvatarMenu />
        </nav>

        {children}
      </div>
    </Suspense>
  );
}
