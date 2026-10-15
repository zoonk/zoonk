import { LazyStartClient } from "@/app/[lang]/(app)/(onboarding)/start/lazy-start-client";
import { loadStartView } from "@/app/[lang]/(app)/(onboarding)/start/start-view";
import { LessonPlayerPreload } from "@/app/[lang]/explain/[goalId]/lazy-lesson-player";
import { AuthGatePage } from "@/components/auth-gate";
import { NotFoundPage } from "@/components/errors/not-found-page";
import { LearnerWitness } from "@/components/learner/learner-witness";
import { Link } from "@/i18n/navigation";
import { type LearnerViewStamp } from "@/lib/learner/learner-view-copies";
import { hasSessionCookie } from "@zoonk/auth/cookies";
import { listCurrentUserGoals } from "@zoonk/core/goals/list-current-user";
import { type SuggestedGoalView } from "@zoonk/core/goals/suggestions/contract";
import { getOnboardingResume } from "@zoonk/core/view-models/onboarding/resume";
import { Page } from "@zoonk/learn/page";
import { TodayPageHeader } from "@zoonk/learn/today/at-rest";
import { TodayShell } from "@zoonk/learn/today/shell";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { PlayIcon } from "lucide-react";
import { type Metadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { LearnNotFound } from "../_components/learn-not-found";
import {
  SuggestedGoalClient,
  TodayClient,
  TodayPreparingClient,
  TodayStateSync,
} from "./today-client";
import { TodayGoalPaused } from "./today-goal-paused";
import { getLocalDay } from "./today-local-day";
import { TodayOnboardingLeft, isOnboardingLeft } from "./today-onboarding-left";
import { loadTodayScreen } from "./today-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { title: t("Today") };
}

/**
 * A learner back from before goals existed, with no goal yet: their last course comes first, and
 * either answer moves them on to onboarding.
 */
async function WelcomeBack({ suggestion }: { suggestion: SuggestedGoalView }) {
  const t = await getExtracted();

  return (
    <Page className="gap-5">
      <TodayPageHeader date={null} title={t("Welcome back")} />
      <SuggestedGoalClient suggestion={suggestion} />
    </Page>
  );
}

type Explanation = { id: string; title: string };

/**
 * A quick explanation the learner hasn't finished, first on a Today without a goal: Sam came for
 * "What does 'the market is up 2%' mean?", and only search found it again.
 */
async function ExplanationContinue({ explanation }: { explanation: Explanation }) {
  const t = await getExtracted();

  return (
    <section aria-label={t("Your quick explanation")} className="flex flex-col gap-3">
      <div className="bg-muted -mx-2.5 flex items-start gap-3 rounded-[0.625rem] px-2.5 py-2.75">
        <PlayIcon aria-hidden="true" className="text-muted-foreground mt-0.5 size-4 shrink-0" />
        <span className="flex min-w-0 flex-col gap-px">
          <span className="text-sm leading-5 font-medium text-pretty">{explanation.title}</span>
          <span className="text-muted-foreground text-xs leading-4">{t("Quick explanation")}</span>
        </span>
      </div>

      {/* Prefetched with its explanation, its player preloaded, so it opens at once. */}
      <LessonPlayerPreload />
      <Link
        className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto sm:self-start")}
        href={`/explain/${explanation.id}`}
        prefetch
      >
        {t("Continue explanation")}
      </Link>
    </section>
  );
}

/**
 * The learner's newest quick explanation not read to the end, and their day's date in its time
 * zone; nothing for a visitor.
 */
async function loadNoGoalContext(locale: string) {
  const list = await listCurrentUserGoals();
  const goals = list?.goals ?? [];

  const explanation = goals.findLast(
    (goal) => goal.kind === "explain" && goal.status !== "completed" && goal.status !== "archived",
  );

  const date = await getLocalDay({
    locale,
    timeZone: goals.find((goal) => goal.timezone)?.timezone ?? null,
  });

  return {
    date,
    explanation: explanation ? { id: explanation.id, title: explanation.title } : null,
  };
}

/** The complete no-goal display can prefetch; starting a goal still claims its fresh limit. */
async function loadFirstGoalView(locale: string) {
  "use cache: private";

  const resume = await getOnboardingResume();

  const draftId =
    resume.status === "ready" && resume.resume?.kind === "draft" ? resume.resume.draftId : null;

  const [start, context] = await Promise.all([loadStartView(draftId), loadNoGoalContext(locale)]);
  return { context, start };
}

/**
 * A learner without a goal, or a visitor, starts one right here, under Today's own title: an
 * unfinished quick explanation first, then "Start a goal" with the start form (or the goal they
 * typed and haven't confirmed yet) on the page's edges, and from 72rem the examples and how it
 * works in Today's aside. The flow lays out the page (`header` is Today's top), since its aside
 * follows the screen. Confirming it goes on to the goal's own questions.
 */
async function TodayFirstGoal() {
  const t = await getExtracted();
  const locale = await getLocale();
  const { start, context } = await loadFirstGoalView(locale);
  const { canAttach, draft, goalLimit, needsAccount } = start;

  return (
    <>
      <LearnerWitness />

      <LazyStartClient
                canAttach={canAttach}
        defaultGoal=""
        embedded
        goalLimit={goalLimit}
        header={
          <>
            <TodayPageHeader date={context.date} title={t("Today")} />
            {context.explanation && <ExplanationContinue explanation={context.explanation} />}
          </>
        }
        initialDraft={draft}
        needsAccount={needsAccount}
        planId={null}
      />
    </>
  );
}

/**
 * A browser that still carries a session cookie with no session behind it (it expired, or ended
 * on another tab): its plan is still in its account, so Today says so and leads back to it,
 * instead of offering a first goal as to someone new, who'd build the plan again as a guest.
 */
async function TodaySessionEnded() {
  const t = await getExtracted();

  return (
    <AuthGatePage
      description={t("Each day's lessons, reviews and practice for your goal.")}
      ended
      next="/today"
      title={t("Today")}
    />
  );
}

/** The learner and the revision a state other than the day was read at, to keep it fresh. */
function toStamp(result: { revision: string; userId: string }): LearnerViewStamp {
  return { day: null, revision: result.revision, userId: result.userId };
}

async function TodayContent() {
  const result = await loadTodayScreen();

  if (result.status === "noGoal") {
    return (
      <>
        <LearnerWitness />
        <TodayStateSync stamp={toStamp(result)} state={result.status} />
        {result.suggestedGoal ? (
          <WelcomeBack suggestion={result.suggestedGoal} />
        ) : (
          <TodayFirstGoal />
        )}
      </>
    );
  }

  // A cookie without a session behind it is a learner whose session ended, not someone new.
  if (result.status === "unauthorized" && hasSessionCookie(await cookies())) {
    return (
      <>
        <LearnerWitness />
        <TodaySessionEnded />
      </>
    );
  }

  // Someone without a session hasn't started anything here either: they start right away, or log
  // in from the frame.
  if (result.status === "unauthorized") {
    return <TodayFirstGoal />;
  }

  if (result.status === "goalNotActive") {
    return (
      <>
        <LearnerWitness />
        <TodayStateSync stamp={toStamp(result)} state={result.status} />
        <TodayGoalPaused revision={result.revision} />
      </>
    );
  }

  if (result.status === "preparing") {
    return (
      <>
        <LearnerWitness />
        <TodayStateSync stamp={toStamp(result)} state={result.status} />
        <TodayPreparingState goal={result.goal} />
      </>
    );
  }

  // A goal Today can't find says so in Today's place; the app's bar stays Today's own.
  if (result.status !== "ready") {
    return (
      <NotFoundPage>
        <LearnerWitness />
        <LearnNotFound bar={null} />
      </NotFoundPage>
    );
  }

  return (
    <>
      <LearnerWitness />
      <TodayClient copy={result.copy} key={result.copy.day} />
    </>
  );
}

/** A goal whose plan is being built, or one left halfway through its questions. */
async function TodayPreparingState({ goal }: { goal: { id: string; title: string } }) {
  // A goal left halfway through its questions has no plan coming until they're answered.
  if (await isOnboardingLeft(goal.id)) {
    return (
      <>
        <LearnerWitness />
        <TodayOnboardingLeft goal={goal} />
      </>
    );
  }

  return (
    <>
      <LearnerWitness />
      <TodayPreparingClient goalId={goal.id} goalTitle={goal.title} />
    </>
  );
}

/**
 * Today, the screen learners open every day: one next step for the active goal. A client
 * navigation paints it from its prefetch; a hard load paints Today's frame (`TodayShell`) until the
 * day streams into the same response, with no placeholders, and the title doesn't move.
 */
export default function TodayPage() {
  return (
    <Suspense fallback={<TodayShell />}>
      <TodayContent />
    </Suspense>
  );
}
