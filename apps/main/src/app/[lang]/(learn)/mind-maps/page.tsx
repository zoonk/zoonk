import { JourneyPageBar } from "@/components/learn/journey-page-bar";
import { getCurrentGoal } from "@/lib/learn/current-goal";
import { listGoalMindMaps } from "@zoonk/core/mind-maps/list";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LearnNoGoal } from "../_components/learn-no-goal";
import { MindMapsClient } from "./mind-maps-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { title: t("Mind maps") };
}

async function MindMapsBody() {
  const goal = await getCurrentGoal();

  if (!goal) {
    return (
      <>
        <JourneyPageBar />
        <LearnNoGoal />
      </>
    );
  }

  const result = await listGoalMindMaps({ goalId: goal.id });

  if (result.status !== "ready") {
    notFound();
  }

  return <MindMapsClient goalId={goal.id} mindMaps={result.mindMaps} />;
}

function MindMapsSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-5">
        <JourneyPageBar />
        <div className="flex items-center gap-4">
          <Skeleton className="size-16 rounded-2xl" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-9 w-40" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Skeleton className="aspect-square w-full rounded-xl" />
        <Skeleton className="aspect-square w-full rounded-xl" />
        <Skeleton className="aspect-square w-full rounded-xl" />
      </div>
    </div>
  );
}

/**
 * The mind maps of the goal in the switcher: every chapter the learner finished under its subject,
 * each map opening full screen, and a tap to make the ones that don't exist yet.
 */
export default function MindMapsPage() {
  return (
    <Suspense fallback={<MindMapsSkeleton />}>
      <MindMapsBody />
    </Suspense>
  );
}
