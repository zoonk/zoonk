import { CATALOG_TOP_TARGET_ID } from "@/components/catalog/catalog-top-target";
import { getSession } from "@/data/users/get-session";
import { AvatarSkeleton } from "@zoonk/ui/components/avatar";
import { Navbar } from "@zoonk/ui/components/navbar";
import { Suspense } from "react";
import { NavbarLinks, NavbarLinksSkeleton } from "./_components/navbar-links";
import { NavbarUserSlot } from "./_components/navbar-user-slot";
import { UserAvatarMenu } from "./_components/user-avatar-menu";

async function NavbarLinksWithAuth() {
  const session = await getSession();
  return <NavbarLinks isLoggedIn={Boolean(session)} />;
}

export default function CatalogLayout({ children }: LayoutProps<"/[lang]">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar>
        <Suspense fallback={<NavbarLinksSkeleton />}>
          <NavbarLinksWithAuth />
        </Suspense>

        <Suspense fallback={<AvatarSkeleton />}>
          <NavbarUserSlot>
            <UserAvatarMenu />
          </NavbarUserSlot>
        </Suspense>
      </Navbar>

      <div aria-hidden="true" className="scroll-mt-20" id={CATALOG_TOP_TARGET_ID} />

      {children}
    </div>
  );
}
