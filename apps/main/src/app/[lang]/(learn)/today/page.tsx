import { getDraftHref } from "@/app/[lang]/start/start-params";
import { UploadRequestClient } from "@/components/learn/upload-request-client";
import { redirect } from "@/i18n/navigation";
import { getLearnerBuddy } from "@/lib/learn/learner-buddy";
import { getReadAt } from "@/lib/learn/read-at";
import { getMockOptions } from "@zoonk/core/exams/mocks/options";
import { type SuggestedGoalView } from "@zoonk/core/goals/suggestions/contract";
import { listGoalChangeNotices } from "@zoonk/core/library/sources/notices";
import { getGoalUploadRequest } from "@zoonk/core/library/sources/upload-request";
import { listCurrentUserMistakes } from "@zoonk/core/mistakes/list-current-user";
import { getLanguageTodayView } from "@zoonk/core/view-models/language/today";
import { getOnboardingResume } from "@zoonk/core/view-models/onboarding/resume";
import { getPlanTabView } from "@zoonk/core/view-models/plan/get";
import { type TodayView, getTodayView } from "@zoonk/core/view-models/today/get";
import { LanguagePracticeRow } from "@zoonk/learn/language/today";
import { type TodayHostNotices } from "@zoonk/learn/today";
import { TodayChangeNotice } from "@zoonk/learn/today/change-notice";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { lang } from "next/root-params";
import { Suspense } from "react";
import { SuggestedGoalClient, TodayClient, TodayPreparingClient } from "./today-client";
import { TodayGoalPaused } from "./today-goal-paused";

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
    <div className="flex flex-col gap-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("Welcome back")}</h1>
      <SuggestedGoalClient suggestion={suggestion} />
    </div>
  );
}

/** Without a goal, a goal they typed and haven't confirmed comes back; otherwise a new one. */
async function getStartHref() {
  const result = await getOnboardingResume();

  return result.status === "ready" && result.resume?.kind === "draft"
    ? getDraftHref(result.resume.draftId)
    : "/start";
}

/** A language goal's due practice; nothing for other goals. */
async function loadLanguageToday(goal: TodayView["goal"]) {
  if (goal.kind !== "language") {
    return null;
  }

  const result = await getLanguageTodayView({ goalId: goal.id });
  return result.status === "ready" ? result.today : null;
}

/**
 * The notices Today can show that need main's actions, each drawn only when there's something to
 * say. Today shows the most important one.
 */
async function loadHostNotices(goal: TodayView["goal"]) {
  const [changes, upload, language] = await Promise.all([
    listGoalChangeNotices({ goalId: goal.id }),
    getGoalUploadRequest({ goalId: goal.id }),
    loadLanguageToday(goal),
  ]);

  const latestChange = changes.status === "ready" ? changes.notices[0] : undefined;
  const request = upload.status === "ready" ? upload.request : null;
  const hasPractice = Boolean(language?.pattern ?? language?.pronunciation);

  const notices: TodayHostNotices = {
    practice:
      language && hasPractice ? (
        <LanguagePracticeRow
          hrefs={{
            pattern: language.pattern ? `/pattern/${language.pattern.id}` : null,
            pronunciation: `/pronunciation?goal=${goal.id}`,
          }}
          today={language}
        />
      ) : null,
    sourceChange: latestChange ? <TodayChangeNotice message={latestChange.message} /> : null,
    uploadRequest: request ? <UploadRequestClient request={request} /> : null,
  };

  return notices;
}

/**
 * The plan's end as the Journey shows it, read only when Today has a proposed plan change to
 * explain for a plan without a date: that's the one case its sentence names an end.
 */
async function loadPlanEnd(today: TodayView): Promise<string | null> {
  const proposed =
    today.insight?.planChange?.status === "proposed" || today.planChange?.status === "proposed";

  if (!proposed || today.goal.targetDate) {
    return null;
  }

  const result = await getPlanTabView({ goalId: today.goal.id });
  return result.status === "ready" ? result.view.plan.estimate.endDate : null;
}

/**
 * An exam goal's mocks to take any time, which Today offers under "Practice anytime" to every
 * learner: without Plus, the row is marked Plus and its chooser says what Plus unlocks. Nothing
 * while no mock can be built.
 */
async function loadTodayMocks(goal: TodayView["goal"]) {
  if (goal.kind !== "exam") {
    return null;
  }

  const result = await getMockOptions({ goalId: goal.id });
  const view = result.status === "ready" ? result.view : null;

  return view && (view.running || view.options.length > 0) ? view : null;
}

/** Open entries in the goal's mistakes notebook, which Today offers under "Practice anytime". */
async function countOpenMistakes(goalId: string): Promise<number> {
  const result = await listCurrentUserMistakes({ goalId, limit: 1, offset: 0, status: "open" });
  return result.status === "ready" ? result.counts.open : 0;
}

async function TodayContent() {
  // The root param, not `params`: a prefetch warms its caches with `params` still pending.
  const [language, result] = await Promise.all([lang(), getTodayView({})]);

  if (result.status === "unauthorized") {
    redirect({ href: "/login", locale: language });
  }

  if (result.status === "noGoal" && result.suggestedGoal) {
    return <WelcomeBack suggestion={result.suggestedGoal} />;
  }

  // Never back to the home page, where learners with an account are sent here from.
  if (result.status === "noGoal") {
    redirect({ href: await getStartHref(), locale: language });
  }

  if (result.status === "goalNotActive") {
    return <TodayGoalPaused />;
  }

  if (result.status === "preparing") {
    return <TodayPreparingClient goalId={result.goal.id} goalTitle={result.goal.title} />;
  }

  if (result.status !== "ready") {
    notFound();
  }

  const [buddy, notices, planEnd, readAt, mocks, mistakes] = await Promise.all([
    getLearnerBuddy(),
    loadHostNotices(result.today.goal),
    loadPlanEnd(result.today),
    getReadAt(),
    loadTodayMocks(result.today.goal),
    countOpenMistakes(result.today.goal.id),
  ]);

  return (
    <TodayClient
      buddy={buddy}
      mistakes={mistakes}
      mocks={mocks}
      notices={notices}
      planEnd={planEnd}
      readAt={readAt}
      today={result.today}
    />
  );
}

/** Today's shape while it loads: the title and its line, the session's section and the week's. */
function TodaySkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2 px-1">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-5 w-52" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    </div>
  );
}

/**
 * Today, the screen learners open every day: one next step for the active goal, on the session
 * card.
 */
export default function TodayPage() {
  return (
    <Suspense fallback={<TodaySkeleton />}>
      <TodayContent />
    </Suspense>
  );
}
