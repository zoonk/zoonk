"use cache";

import { Navbar } from "@zoonk/ui/components/navbar";
import { cacheTagCatalog } from "@zoonk/utils/cache";
import { cacheLife, cacheTag } from "next/cache";
import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { NavbarLinks, NavbarLinksSkeleton } from "@/components/navbar-links";
import { UserAvatarMenu } from "@/components/user-avatar-menu";
import { CatalogCommandPaletteProvider } from "./command-palette-provider";

type CatalogLayoutProps = LayoutProps<"/[locale]"> & {
  commandPalette: React.ReactNode;
};

export default async function CatalogLayout({
  children,
  commandPalette,
  params,
}: CatalogLayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  cacheLife("max");
  cacheTag(locale, cacheTagCatalog());

  return (
    <CatalogCommandPaletteProvider>
      <div className="flex min-h-dvh flex-col">
        <Navbar>
          <Suspense fallback={<NavbarLinksSkeleton />}>
            <NavbarLinks />
          </Suspense>

          <UserAvatarMenu />
        </Navbar>

        {children}
      </div>

      {commandPalette}
    </CatalogCommandPaletteProvider>
  );
}
