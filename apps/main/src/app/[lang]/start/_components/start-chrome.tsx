import { LearnBarEnd, LearnBarEndSkeleton } from "@/app/[lang]/(learn)/_components/learn-bar-end";
import {
  LearnGoalMenu,
  LearnGoalMenuSkeleton,
} from "@/app/[lang]/(learn)/_components/learn-goal-menu";
import { LoginBarLink } from "@/components/login-bar-link";
import { PublicTopBar } from "@/components/public/public-top-bar";
import { listCurrentUserGoals } from "@zoonk/core/goals/list-current-user";
import { getSession } from "@zoonk/core/users/session";
import { LearnShellHeader, LearnShellStart } from "@zoonk/learn/shell";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { Suspense } from "react";

/**
 * The home page's bar, made quiet for onboarding: it sits over the screen's own background and
 * doesn't follow the scroll, so the screen's next step leads.
 */
const START_TOP_BAR_CLASS =
  "static bg-transparent backdrop-blur-none supports-backdrop-filter:bg-transparent";

/**
 * The home page's bar, for visitors and guests: also the bar right after an under-13 answer
 * deletes the account, since the session read earlier in that request still names the learner.
 */
export function VisitorTopBar() {
  return <PublicTopBar actions={<LoginBarLink />} className={START_TOP_BAR_CLASS} />;
}

/**
 * The learner's goals, once they have one. Before their first goal the switcher would only link to
 * the page they're on.
 */
async function StartGoalMenu() {
  const list = await listCurrentUserGoals();
  return list && list.goals.length > 0 ? <LearnGoalMenu /> : null;
}

/**
 * A learner starting a goal keeps the app's own bar: their goals on the left, their account on the
 * right. The tabs stay out, so nothing competes with the step they're on.
 */
function LearnerTopBar() {
  return (
    <LearnShellHeader>
      <LearnShellStart>
        <Suspense fallback={<LearnGoalMenuSkeleton />}>
          <StartGoalMenu />
        </Suspense>
      </LearnShellStart>

      <Suspense fallback={<LearnBarEndSkeleton />}>
        <LearnBarEnd />
      </Suspense>
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
      <Skeleton className="h-11 w-20 rounded-full lg:h-10" />
    </div>
  );
}
