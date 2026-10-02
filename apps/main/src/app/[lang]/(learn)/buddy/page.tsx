import { getBuddyStatus } from "@zoonk/core/milestones/buddy";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { LearnNoGoal } from "../_components/learn-no-goal";
import { BuddyPageClient } from "./buddy-page-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { title: t("Your buddy") };
}

async function BuddyContent() {
  const result = await getBuddyStatus({});

  if (result.status !== "ready") {
    return <LearnNoGoal />;
  }

  return <BuddyPageClient status={result.buddy} />;
}

function BuddySkeleton() {
  return (
    <div className="flex flex-col items-center gap-4">
      <Skeleton className="size-40 rounded-full" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-28 w-full rounded-3xl" />
      <Skeleton className="h-20 w-full rounded-3xl" />
      <Skeleton className="h-56 w-full rounded-3xl" />
    </div>
  );
}

/** The buddy's page, where Fun's dock buddy leads: Energy, growth, what it ate and its glasses. */
export default function BuddyPage() {
  return (
    <Suspense fallback={<BuddySkeleton />}>
      <BuddyContent />
    </Suspense>
  );
}
