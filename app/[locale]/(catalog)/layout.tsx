"use cache";

import { unstable_cacheLife as cacheLife } from "next/cache";
import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { NavbarLinks } from "@/components/navbar-links";
import { UserAvatarMenu } from "@/components/user-avatar-menu";

export default async function CatalogLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  cacheLife("max");
  const { locale } = await params;
  setRequestLocale(locale);

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
