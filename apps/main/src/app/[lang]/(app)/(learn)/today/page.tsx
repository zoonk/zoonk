import { LazyStartClient } from "@/app/[lang]/(app)/(onboarding)/start/lazy-start-client";
import { loadStartView } from "@/app/[lang]/(app)/(onboarding)/start/start-view";
import { LessonPlayerPreload } from "@/app/[lang]/explain/[goalId]/lazy-lesson-player";
import { AuthGatePage } from "@/components/auth-gate";
import { NotFoundPage } from "@/components/errors/not-found-page";
import { Link } from "@/i18n/navigation";
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
import { SuggestedGoalClient, TodayClient } from "./today-client";
import { TodayGoalPaused } from "./today-goal-paused";
import { getLocalDay } from "./today-local-day";
import { TodayOnboardingLeft, isOnboardingLeft } from "./today-onboarding-left";
import { TodayPreparingClient } from "./today-preparing-client";
import { loadTodayScreen } from "./today-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { title: t("Today") };
}

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

async function TodayFirstGoal() {
  const t = await getExtracted();
  const locale = await getLocale();
  const { start, context } = await loadFirstGoalView(locale);
  const { canAttach, draft, goalLimit, needsAccount } = start;

  return (
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
  );
}

/** The plan is still in the account, so this leads back to it instead of a first goal built again as a guest. */
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

async function TodayContent() {
  const result = await loadTodayScreen();

  if (result.status === "noGoal") {
    return result.suggestedGoal ? (
      <WelcomeBack suggestion={result.suggestedGoal} />
    ) : (
      <TodayFirstGoal />
    );
  }

  // A cookie without a session behind it is a learner whose session ended, not someone new.
  if (result.status === "unauthorized" && hasSessionCookie(await cookies())) {
    return <TodaySessionEnded />;
  }

  if (result.status === "unauthorized") {
    return <TodayFirstGoal />;
  }

  if (result.status === "goalNotActive") {
    return <TodayGoalPaused />;
  }

  if (result.status === "preparing") {
    return <TodayPreparingState goal={result.goal} />;
  }

  if (result.status !== "ready") {
    return (
      <NotFoundPage>
        <LearnNotFound bar={null} />
      </NotFoundPage>
    );
  }

  return (
    <TodayClient
      data={result.data}
      key={result.day}
      readAt={result.readAt}
      userId={result.userId}
    />
  );
}

async function TodayPreparingState({ goal }: { goal: { id: string; title: string } }) {
  // A goal left halfway through its questions has no plan coming until they're answered.
  if (await isOnboardingLeft(goal.id)) {
    return <TodayOnboardingLeft goal={goal} />;
  }

  return <TodayPreparingClient goalId={goal.id} goalTitle={goal.title} />;
}

export default function TodayPage() {
  return (
    <Suspense fallback={<TodayShell />}>
      <TodayContent />
    </Suspense>
  );
}
