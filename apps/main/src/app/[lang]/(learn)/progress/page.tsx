import { RebalanceSection } from "@/components/learn/rebalance-section";
import { getLearnerBuddy } from "@/lib/learn/learner-buddy";
import { getLanguageProgressView } from "@zoonk/core/view-models/language/progress";
import { getProgressView } from "@zoonk/core/view-models/progress/get";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LearnNoGoal } from "../_components/learn-no-goal";
import { LanguageProgressClient } from "./language-progress-client";
import { ProgressScreenClient } from "./progress-screen-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { title: t("Progress") };
}

async function ProgressContent() {
  const [result, buddy, language] = await Promise.all([
    getProgressView(),
    getLearnerBuddy(),
    getLanguageProgressView(),
  ]);

  if (result.status === "noGoal" || result.status === "unauthorized") {
    return <LearnNoGoal />;
  }

  if (result.status !== "ready") {
    notFound();
  }

  return (
    <>
      {/* The latest rebalance streams on its own, so Progress never waits for it. */}
      <Suspense fallback={null}>
        <RebalanceSection goalId={result.progress.goal.id} buddy={buddy} />
      </Suspense>
      {/* A language goal measures progress by level per skill; other goals keep preparation. */}
      {language.status === "ready" ? (
        <LanguageProgressClient language={language.progress} progress={result.progress} />
      ) : (
        <ProgressScreenClient progress={result.progress} />
      )}
    </>
  );
}

function ProgressSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-12 w-28" />
      <Skeleton className="h-72 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  );
}

/** Preparation for the goal in the switcher (the preparation ring in Fun), and the stats behind it. */
export default function ProgressPage() {
  return (
    <Suspense fallback={<ProgressSkeleton />}>
      <ProgressContent />
    </Suspense>
  );
}
