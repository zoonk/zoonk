import { CATALOG_TOP_TARGET_ID } from "@/components/catalog/catalog-top-target";
import { SectionFrame } from "@/components/learn/section-frame";
import { LoginBarLink } from "@/components/login-bar-link";
import { ClientMessagesProvider } from "@/i18n/client-messages-provider";
import { getSession } from "@zoonk/core/users/session";
import { AvatarSkeleton } from "@zoonk/ui/components/avatar";
import { Suspense } from "react";
import { UserAvatarMenu } from "./_components/user-avatar-menu";

/** The bar's end: the account's menu, or a visitor's way in. */
async function CatalogBarEnd() {
  const session = await getSession();
  return session ? <UserAvatarMenu /> : <LoginBarLink />;
}

/**
 * The catalog is a section: its own bar (the way home, and the account's menu or a visitor's way
 * in) over a page as wide as the screen, so the grid has room for its columns on large screens.
 * The page names itself ("Explore courses"), so the bar doesn't.
 */
export default function CatalogLayout({ children }: LayoutProps<"/[lang]">) {
  return (
    <ClientMessagesProvider scope="learn">
      <SectionFrame
        end={
          <Suspense fallback={<AvatarSkeleton className="size-11 lg:size-10" />}>
            <CatalogBarEnd />
          </Suspense>
        }
        home
        wide
      >
        <div aria-hidden="true" className="scroll-mt-24" id={CATALOG_TOP_TARGET_ID} />
        {children}
      </SectionFrame>
    </ClientMessagesProvider>
  );
}
