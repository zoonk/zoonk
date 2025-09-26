import { Suspense } from "react";
import { NavbarLinks } from "@/components/NavbarLinks";
import { UserAvatarSkeleton } from "@/components/UserAvatar";
import { UserAvatarMenu } from "@/components/UserAvatarMenu";

export default function CatalogLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  return (
    <>
      <nav className="flex w-full items-center justify-between gap-2 p-4">
        <NavbarLinks />

        <Suspense fallback={<UserAvatarSkeleton />}>
          <UserAvatarMenu params={params} />
        </Suspense>
      </nav>

      {children}
    </>
  );
}
