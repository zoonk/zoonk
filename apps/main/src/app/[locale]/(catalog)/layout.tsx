"use cache";

import { CommandPaletteProvider } from "@zoonk/next/patterns/command";
import { Navbar } from "@zoonk/ui/components/navbar";
import { cacheTagCatalog } from "@zoonk/utils/cache";
import { cacheLife, cacheTag } from "next/cache";
import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { NavbarLinks, NavbarLinksSkeleton } from "@/components/navbar-links";
import { UserAvatarMenu } from "@/components/user-avatar-menu";

export default async function CatalogLayout({
  children,
  commandPalette,
  params,
}: LayoutProps<"/[locale]"> & {
  commandPalette: React.ReactNode;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  cacheLife("max");
  cacheTag(locale, cacheTagCatalog());

  return (
    <CommandPaletteProvider>
      <div className="flex min-h-dvh flex-col">
        <Navbar>
          <Suspense fallback={<NavbarLinksSkeleton />}>
            <NavbarLinks />
          </Suspense>

          <UserAvatarMenu />
        </Navbar>

        {children}
      </div>

      <Suspense>{commandPalette}</Suspense>
    </CommandPaletteProvider>
  );
}
