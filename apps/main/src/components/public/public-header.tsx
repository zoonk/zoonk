import { UserAvatarMenu } from "@/app/[lang]/(catalog)/_components/user-avatar-menu";
import { Link } from "@/i18n/navigation";
import { getSession } from "@zoonk/core/users/session";
import { ButtonSkeleton, buttonVariants } from "@zoonk/ui/components/button";
import { getExtracted } from "next-intl/server";
import { type ReactNode, Suspense } from "react";
import { PublicTopBar } from "./public-top-bar";

/** Visitors get a way back to their account; signed-in learners get their menu. */
async function AccountAction() {
  const [session, t] = await Promise.all([getSession(), getExtracted()]);

  if (session) {
    return <UserAvatarMenu />;
  }

  return (
    <Link className={buttonVariants({ variant: "outline" })} href="/login">
      {t("Log in")}
    </Link>
  );
}

/**
 * Public pages keep the top bar quiet so the page's one next step leads: the
 * brain goes home, and the page's options and an account action sit on the right.
 */
export async function PublicHeader({ options }: { options?: ReactNode }) {
  const t = await getExtracted();

  return (
    <PublicTopBar
      actions={
        <>
          {options}
          <Suspense fallback={<ButtonSkeleton variant="outline">{t("Log in")}</ButtonSkeleton>}>
            <AccountAction />
          </Suspense>
        </>
      }
    />
  );
}
