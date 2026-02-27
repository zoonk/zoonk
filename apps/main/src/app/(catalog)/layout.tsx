import { getSession } from "@zoonk/core/users/session/get";
import { AvatarSkeleton } from "@zoonk/ui/components/avatar";
import { Navbar } from "@zoonk/ui/components/navbar";
import { Suspense } from "react";
import { NavbarLinks, NavbarLinksSkeleton } from "./_components/navbar-links";
import { UserAvatarMenu } from "./_components/user-avatar-menu";

async function NavbarLinksWithAuth() {
  const session = await getSession();
  return <NavbarLinks isLoggedIn={Boolean(session)} />;
}

export default function CatalogLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar>
        <Suspense fallback={<NavbarLinksSkeleton />}>
          <NavbarLinksWithAuth />
        </Suspense>

        <Suspense fallback={<AvatarSkeleton />}>
          <UserAvatarMenu />
        </Suspense>
      </Navbar>

      {children}
    </div>
  );
}
