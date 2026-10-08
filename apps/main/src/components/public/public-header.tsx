import { UserAvatarMenu } from "@/app/[lang]/(catalog)/_components/user-avatar-menu";
import { LearnGoalMenu } from "@/app/[lang]/(learn)/_components/learn-goal-menu";
import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { LoginBarLink } from "@/components/login-bar-link";
import { ClientMessagesProvider } from "@/i18n/client-messages-provider";
import { getBeltLevel } from "@zoonk/core/progress/get-belt-level";
import { getSession } from "@zoonk/core/users/session";
import { LearnAvatarBelt } from "@zoonk/learn/avatar-belt";
import { ButtonSkeleton } from "@zoonk/ui/components/button";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { getExtracted } from "next-intl/server";
import { type ReactNode, Suspense } from "react";
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
    <ClientMessagesProvider scope="learn">
      <MainLearnProvider>
        <LearnGoalMenu />
      </MainLearnProvider>
    </ClientMessagesProvider>
  );
}

/** Visitors get a way into their account; anyone with a session gets the app's account menu. */
async function AccountAction() {
  const session = await getSession();

  if (!session) {
    return <LoginBarLink />;
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
 * home (or, with a session, the goal switcher), and the page's options and an account action on
 * the right.
 */
export async function PublicHeader({ options }: { options?: ReactNode }) {
  const t = await getExtracted();

  return (
    <PublicTopBar
      actions={
        <>
          {options}
          <Suspense
            fallback={
              <ButtonSkeleton size="bar" variant="outline">
                {t("Log in")}
              </ButtonSkeleton>
            }
          >
            <AccountAction />
          </Suspense>
        </>
      }
      start={
        <Suspense fallback={<Skeleton className="size-7 rounded-full" />}>
          <BarStart />
        </Suspense>
      }
    />
  );
}
