import { UserAvatarMenu } from "@/app/[lang]/(app)/(catalog)/_components/user-avatar-menu";
import { LearnGoalMenu } from "@/app/[lang]/(app)/(learn)/_components/learn-goal-menu";
import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { LoginBarLink } from "@/components/login-bar-link";
import { Link } from "@/i18n/navigation";
import { getBeltLevel } from "@zoonk/core/progress/get-belt-level";
import { getSession } from "@zoonk/core/users/session";
import { LearnAvatarBelt } from "@zoonk/learn/avatar-belt";
import { ButtonSkeleton, buttonVariants } from "@zoonk/ui/components/button";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";
import { type ReactNode, Suspense } from "react";
import { PublicNavLinks } from "./public-nav-links";
import { PublicHomeLink, PublicTopBar } from "./public-top-bar";

/**
 * The bar's left: the brain going home for visitors. Anyone with a session is in the app, so they
 * get the app's goal switcher instead of a logo, as on every other screen of theirs.
 */
async function BarStart() {
  const session = await getSession();

  if (!session) {
    return <PublicHomeLink />;
  }

  return (
    <MainLearnProvider>
      <LearnGoalMenu />
    </MainLearnProvider>
  );
}

/**
 * Visitors get the home page's actions (a quiet way into their account and starting free, from
 * tablet widths); anyone with a session gets the app's account menu.
 */
async function AccountAction() {
  const t = await getExtracted();
  const session = await getSession();

  if (!session) {
    return (
      <>
        <LoginBarLink />
        <Link
          className={cn(buttonVariants({ size: "bar" }), "hidden sm:inline-flex")}
          href="/start"
        >
          {t("Start free")}
        </Link>
      </>
    );
  }

  const belt = await getBeltLevel();

  return (
    <LearnAvatarBelt color={belt?.color ?? null}>
      <UserAvatarMenu />
    </LearnAvatarBelt>
  );
}

/**
 * Public pages keep the top bar quiet so the page's one next step leads: on the left the brain
 * home (or, with a session, the goal switcher), and on the right the courses and pricing, the
 * page's options and an account action.
 */
export async function PublicHeader({ options }: { options?: ReactNode }) {
  const t = await getExtracted();

  return (
    <PublicTopBar
      actions={
        <>
          <PublicNavLinks />
          {options}
          <Suspense
            fallback={
              <ButtonSkeleton size="bar" variant="ghost">
                {t("Log in")}
              </ButtonSkeleton>
            }
          >
            <AccountAction />
          </Suspense>
        </>
      }
      start={
        <Suspense fallback={<Skeleton className="h-7 w-24 rounded-lg" />}>
          <BarStart />
        </Suspense>
      }
    />
  );
}
