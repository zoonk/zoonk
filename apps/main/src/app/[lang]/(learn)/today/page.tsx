import { getDraftHref } from "@/app/[lang]/start/start-params";
import { RebalanceSection } from "@/components/learn/rebalance-section";
import { SourceChangeSection } from "@/components/learn/source-change-section";
import { UploadRequestSection } from "@/components/learn/upload-request-section";
import { Link, redirect } from "@/i18n/navigation";
import { getLearnerBuddy } from "@/lib/learn/learner-buddy";
import { type SuggestedGoalView } from "@zoonk/core/goals/suggestions/contract";
import { getOnboardingResume } from "@zoonk/core/view-models/onboarding/resume";
import { getTodayView } from "@zoonk/core/view-models/today/get";
import { buttonVariants } from "@zoonk/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@zoonk/ui/components/empty";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { PauseIcon } from "lucide-react";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { lang } from "next/root-params";
import { Suspense } from "react";
import { LanguageTodaySection } from "./language-today-section";
import { SuggestedGoalClient, TodayClient, TodayPreparingClient } from "./today-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { title: t("Today") };
}

/** The active goal is paused or finished: its plan is where it comes back. */
async function GoalPaused() {
  const t = await getExtracted();

  return (
    <Empty className="py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <PauseIcon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{t("This goal is on pause")}</EmptyTitle>
        <EmptyDescription>
          {t("Nothing is planned for it today. Pick another goal above, or start a new one.")}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Link className={buttonVariants()} href="/start">
          {t("Start a new goal")}
        </Link>
      </EmptyContent>
    </Empty>
  );
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

async function TodayContent() {
  // The root param, not `params`: a prefetch warms its caches with `params` still pending.
  const [language, result, buddy] = await Promise.all([
    lang(),
    getTodayView({}),
    getLearnerBuddy(),
  ]);

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
    return <GoalPaused />;
  }

  if (result.status === "preparing") {
    return (
      <TodayPreparingClient buddy={buddy} goalId={result.goal.id} goalTitle={result.goal.title} />
    );
  }

  if (result.status !== "ready") {
    notFound();
  }

  return (
    <>
      <RebalanceSection goalId={result.today.goal.id} buddy={buddy} />
      <SourceChangeSection goalId={result.today.goal.id} />
      <UploadRequestSection className="mb-6" goalId={result.today.goal.id} />
      <TodayClient buddy={buddy} today={result.today} />
      {/* A language goal's situation and noticed pattern stream on their own. */}
      <Suspense fallback={null}>
        <LanguageTodaySection goalId={result.today.goal.id} />
      </Suspense>
    </>
  );
}

function TodaySkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-11 w-2/3" />
        <Skeleton className="h-4 w-56" />
      </div>
      <Skeleton className="h-96 w-full rounded-3xl" />
      <Skeleton className="h-16 w-full rounded-2xl" />
    </div>
  );
}

/**
 * Today, the screen learners open every day: one next step for the active goal, the Focus
 * session card or the Fun flight plan.
 */
export default function TodayPage() {
  return (
    <Suspense fallback={<TodaySkeleton />}>
      <TodayContent />
    </Suspense>
  );
}
