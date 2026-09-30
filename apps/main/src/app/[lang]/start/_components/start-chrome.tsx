import { UserAvatarMenu } from "@/app/[lang]/(catalog)/_components/user-avatar-menu";
import { toStats } from "@/app/[lang]/(learn)/_components/learn-frame";
import {
  LearnGoalMenu,
  LearnGoalMenuSkeleton,
} from "@/app/[lang]/(learn)/_components/learn-goal-menu";
import { PublicTopBar } from "@/components/public/public-top-bar";
import { Link } from "@/i18n/navigation";
import { getBeltLevel } from "@zoonk/core/progress/get-belt-level";
import { getEnergyLevel } from "@zoonk/core/progress/get-energy-level";
import { getSession } from "@zoonk/core/users/session";
import { LearnShellEnd, LearnShellHeader, LearnShellStart } from "@zoonk/learn/shell";
import { LearnStats } from "@zoonk/learn/stats";
import { AvatarSkeleton } from "@zoonk/ui/components/avatar";
import { buttonVariants } from "@zoonk/ui/components/button";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";

/**
 * The home page's bar, made quiet for onboarding: it sits over the screen's own background (deep
 * space in Fun) and doesn't follow the scroll, so the screen's next step leads.
 */
const START_TOP_BAR_CLASS =
  "static bg-transparent backdrop-blur-none supports-backdrop-filter:bg-transparent";

/**
 * The home page's bar, for visitors and guests: also the bar right after an under-13 answer
 * deletes the account, since the session read earlier in that request still names the learner.
 */
export async function VisitorTopBar() {
  const t = await getExtracted();

  return (
    <PublicTopBar
      actions={
        <Link className={buttonVariants({ variant: "outline" })} href="/login" prefetch={false}>
          {t("Log in")}
        </Link>
      }
      className={START_TOP_BAR_CLASS}
    />
  );
}

/**
 * A learner adding a goal keeps the app's own bar: their goals on the left, their numbers and
 * account on the right. The tabs stay out, so nothing competes with the step they're on.
 */
async function LearnerTopBar() {
  const [belt, energy] = await Promise.all([getBeltLevel(), getEnergyLevel()]);

  return (
    <LearnShellHeader column>
      <LearnShellStart>
        <Suspense fallback={<LearnGoalMenuSkeleton />}>
          <LearnGoalMenu />
        </Suspense>
      </LearnShellStart>

      <LearnShellEnd>
        <LearnStats
          hrefs={{ brainPower: "/level", energy: "/energy" }}
          stats={toStats({ belt, energy })}
        />

        <Suspense fallback={<AvatarSkeleton />}>
          <UserAvatarMenu />
        </Suspense>
      </LearnShellEnd>
    </LearnShellHeader>
  );
}

/**
 * The app's bar over every onboarding page: the home page's bar for visitors and guests, the
 * learning tabs' bar for learners with an account.
 */
export async function StartChrome() {
  const session = await getSession();

  return session && !session.user.isAnonymous ? <LearnerTopBar /> : <VisitorTopBar />;
}

/** Holds the bar's height while the session is read. */
export function StartChromeSkeleton() {
  return (
    <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:h-[72px] sm:px-8">
      <Skeleton className="size-7 rounded-full" />
      <Skeleton className="h-9 w-20 rounded-full" />
    </div>
  );
}
