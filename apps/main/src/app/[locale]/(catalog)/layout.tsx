"use cache";

import { Navbar } from "@zoonk/ui/components/navbar";
import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { NavbarLinks, NavbarLinksSkeleton } from "./_components/navbar-links";
import { UserAvatarMenu } from "./_components/user-avatar-menu";

export default async function CatalogLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar>
        <Suspense fallback={<NavbarLinksSkeleton />}>
          <NavbarLinks />
        </Suspense>

        <UserAvatarMenu />
      </Navbar>

      <Suspense>{children}</Suspense>
    </div>
  );
}
