import { getFieldMapView } from "@zoonk/core/view-models/map/get";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LearnNoGoal } from "../../_components/learn-no-goal";
import { MapScreenClient } from "./map-screen-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { title: t("Map of your subject") };
}

async function MapBody() {
  const result = await getFieldMapView();

  if (result.status === "noGoal" || result.status === "unauthorized") {
    return <LearnNoGoal />;
  }

  if (result.status !== "ready") {
    notFound();
  }

  return <MapScreenClient map={result.map} />;
}

function MapSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-24 rounded-full" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-96 w-full rounded-3xl" />
      <Skeleton className="h-16 w-full rounded-3xl" />
    </div>
  );
}

/** The map of the goal's subject: every skill from its skill graph, and what to study next. */
export default function MapPage() {
  return (
    <Suspense fallback={<MapSkeleton />}>
      <MapBody />
    </Suspense>
  );
}
