import { NotFoundPage } from "@/components/errors/not-found-page";
import { JourneyPageBar } from "@/components/learn/journey-page-bar";
import { getCurrentGoal } from "@/lib/learn/current-goal";
import { getReachedCap } from "@zoonk/core/entitlements/contract";
import { getAllowance } from "@zoonk/core/entitlements/get-allowance";
import { listGoalMindMaps } from "@zoonk/core/mind-maps/list";
import { getPlanTabView } from "@zoonk/core/view-models/plan/get";
import { PAGE_COLUMN_CLASS, PageTitle } from "@zoonk/learn/page";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { LearnNoGoal } from "../_components/learn-no-goal";
import { LearnNotFound } from "../_components/learn-not-found";
import { MindMapsClient } from "./mind-maps-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { title: t("Mind maps") };
}

/**
 * The plan's next chapter, whose map comes once it's finished: named while the goal has no map
 * yet. Null when no chapter is next or its lessons aren't counted yet.
 */
function findNextChapter(plan: Awaited<ReturnType<typeof getPlanTabView>>) {
  if (plan.status !== "ready") {
    return null;
  }

  const chapter = plan.view.plan.phases
    .flatMap((phase) => phase.chapters)
    .find((candidate) => candidate.state === "current" && candidate.chapterId);

  const lessonsLeft = chapter ? chapter.lessonsTotal - chapter.lessonsDone : 0;

  if (!chapter?.chapterId || lessonsLeft <= 0) {
    return null;
  }

  return { chapterId: chapter.chapterId, lessonsLeft, title: chapter.title };
}

async function MindMapsBody() {
  const goal = await getCurrentGoal();

  if (!goal) {
    const t = await getExtracted();

    return (
      <LearnNoGoal
        bar={<JourneyPageBar root />}
        description={t("Each chapter's ideas on one map, to review how they connect.")}
        next="/mind-maps"
        title={t("Mind maps")}
      />
    );
  }

  const [result, allowance] = await Promise.all([
    listGoalMindMaps({ goalId: goal.id }),
    getAllowance(),
  ]);

  if (result.status !== "ready") {
    return (
      <NotFoundPage>
        <LearnNotFound />
      </NotFoundPage>
    );
  }

  // Only a goal without maps yet names the chapter whose map comes first: the plan is read then.
  const next =
    result.mindMaps.chapters.length === 0
      ? findNextChapter(await getPlanTabView({ goalId: goal.id }))
      : null;

  return (
    <MindMapsClient
      cap={allowance && getReachedCap({ allowance, kind: "mindMap" })}
      goalId={goal.id}
      mindMaps={result.mindMaps}
      next={next}
    />
  );
}

/**
 * The mind maps' shape while they load: the bar, the header (its title as the page has it, the
 * goal and the count as bars) and the gallery's first tiles.
 */
async function MindMapsSkeleton() {
  const t = await getExtracted();

  return (
    <div aria-busy="true" className="flex flex-col gap-8">
      <JourneyPageBar root />
      <div className={cn(PAGE_COLUMN_CLASS, "flex flex-col gap-8")}>
        <div className="flex flex-col gap-1">
          <span className="flex h-4 items-center">
            <Skeleton className="h-3 w-32 rounded-sm" />
          </span>
          <PageTitle>{t("Mind maps")}</PageTitle>
          <span className="flex h-5 items-end">
            <Skeleton className="h-3 w-20 rounded-sm" />
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] sm:gap-x-4">
          <Skeleton className="rounded-option aspect-square w-full" />
          <Skeleton className="rounded-option aspect-square w-full" />
          <Skeleton className="rounded-option aspect-square w-full" />
        </div>
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
