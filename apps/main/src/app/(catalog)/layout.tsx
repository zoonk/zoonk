import { Navbar } from "@zoonk/ui/components/navbar";
import { Suspense } from "react";
import { NavbarLinks, NavbarLinksSkeleton } from "./_components/navbar-links";
import { UserAvatarMenu } from "./_components/user-avatar-menu";

export default async function CatalogLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar>
        <Suspense fallback={<NavbarLinksSkeleton />}>
          <NavbarLinks />
        </Suspense>

        <UserAvatarMenu />
      </Navbar>

      <Suspense>
        <div className="flex flex-1 flex-col">{children}</div>
      </Suspense>
    </div>
  );
}
