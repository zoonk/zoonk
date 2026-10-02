import { getCurrentGoal } from "@/lib/learn/current-goal";
import { getMistakePractice } from "@zoonk/core/mistakes/practice";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LearnNoGoal } from "../../_components/learn-no-goal";
import { MistakePracticeClient } from "./practice-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { title: t("Practice mistakes") };
}

async function PracticeBody() {
  const goal = await getCurrentGoal();

  if (!goal) {
    return <LearnNoGoal />;
  }

  const result = await getMistakePractice({ goalId: goal.id });

  if (result.status !== "ready") {
    notFound();
  }

  return (
    <MistakePracticeClient
      goalId={goal.id}
      practice={result.practice}
      trueFalseLabels={result.trueFalseLabels}
    />
  );
}

/** A short run over a few open mistakes, each drilled by why it happened. */
export default function MistakePracticePage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
      <PracticeBody />
    </Suspense>
  );
}
