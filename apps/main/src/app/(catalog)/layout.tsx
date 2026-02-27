import { getSession } from "@zoonk/core/users/session/get";
import { AvatarSkeleton } from "@zoonk/ui/components/avatar";
import { Navbar } from "@zoonk/ui/components/navbar";
import { Suspense } from "react";
import { NavbarLinks, NavbarLinksSkeleton } from "./_components/navbar-links";
import { UserAvatarMenu } from "./_components/user-avatar-menu";

export default async function CatalogLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();

  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar>
        <Suspense fallback={<NavbarLinksSkeleton />}>
          <NavbarLinks isLoggedIn={Boolean(session)} />
        </Suspense>

        <Suspense fallback={<AvatarSkeleton />}>
          <UserAvatarMenu />
        </Suspense>
      </Navbar>

      <Suspense>
        <div className="flex flex-1 flex-col">{children}</div>
      </Suspense>
    </div>
  );
}
