import { NotFoundPage } from "@/components/errors/not-found-page";
import { JourneyPageBar } from "@/components/learn/journey-page-bar";
import { getCurrentGoal } from "@/lib/learn/current-goal";
import { getAllowance } from "@zoonk/core/entitlements/get-allowance";
import { listGoalMindMaps } from "@zoonk/core/mind-maps/list";
import { toMindMapsPage } from "@zoonk/learn/mind-maps/page";
import { PAGE_COLUMN_CLASS, PageTitle } from "@zoonk/learn/page";
import { DetailHero, DetailHeroText } from "@zoonk/ui/components/detail";
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

  return (
    <MindMapsClient mindMaps={toMindMapsPage(result.mindMaps)} tier={allowance?.tier ?? "free"} />
  );
}

function MapRowSkeleton() {
  return (
    <div className="flex items-center gap-3 py-2">
      <Skeleton className="size-12 shrink-0 rounded-lg" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-3.5 w-2/3 rounded-sm" />
        <Skeleton className="h-3 w-20 rounded-sm" />
      </div>
    </div>
  );
}

function SubtitleSkeleton() {
  return (
    <span className="flex h-6 items-center pt-1">
      <Skeleton className="h-3.5 w-32 rounded-sm" />
    </span>
  );
}

async function MindMapsSkeleton() {
  const t = await getExtracted();

  return (
    <div aria-busy="true" className="flex flex-col gap-8">
      <JourneyPageBar root />
      <div className={cn(PAGE_COLUMN_CLASS, "flex flex-col gap-8")}>
        <div className="flex flex-col gap-5">
          <DetailHero>
            <DetailHeroText>
              <PageTitle>{t("Mind maps")}</PageTitle>
              <SubtitleSkeleton />
            </DetailHeroText>
          </DetailHero>
          <div className="flex gap-1">
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
        </div>
        <div className="flex flex-col">
          <MapRowSkeleton />
          <MapRowSkeleton />
          <MapRowSkeleton />
        </div>
      </div>
    </div>
  );
}

export default function MindMapsPage() {
  return (
    <Suspense fallback={<MindMapsSkeleton />}>
      <MindMapsBody />
    </Suspense>
  );
}
