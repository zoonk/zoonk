import {
  getDefaultLearnerMilestoneThreshold,
  getLearnerMilestoneCopy,
  parseLearnerMilestoneKind,
  parseLearnerMilestoneThreshold,
} from "@/lib/learner-milestone-filters";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { Suspense } from "react";
import { StatsPageLayout, StatsPageSkeleton } from "../../_components/stats-page-layout";
import { LearnerMilestoneThresholdForm } from "./learner-milestone-threshold-form";
import { LearnerMilestoneUsers, LearnerMilestoneUsersSkeleton } from "./learner-milestone-users";

export const metadata: Metadata = { title: "Learner Milestones" };
export const prefetch = "allow-runtime";

/**
 * The route keeps a useful analytics shell while its milestone definition is
 * derived from request-time query parameters.
 */
export default function LearnerMilestoneUsersPage({
  searchParams,
}: PageProps<"/stats/engagement/learners">) {
  return (
    <Suspense
      fallback={
        <StatsPageSkeleton
          breadcrumbItems={[
            { href: "/stats/engagement", label: "Engagement & Learning" },
            { label: "Learner Milestones" },
          ]}
          showPeriodControls={false}
          title="Learner Milestones"
        >
          <LearnerMilestoneUsersPageSkeleton />
        </StatsPageSkeleton>
      }
    >
      <LearnerMilestoneUsersPageContent searchParams={searchParams} />
    </Suspense>
  );
}

/**
 * Parsing and validation remain together inside Suspense so every downstream
 * component receives one consistent milestone definition.
 */
async function LearnerMilestoneUsersPageContent({
  searchParams,
}: Pick<PageProps<"/stats/engagement/learners">, "searchParams">) {
  const params = await searchParams;
  const kind = parseLearnerMilestoneKind(params.kind);

  const threshold = parseLearnerMilestoneThreshold({
    defaultValue: getDefaultLearnerMilestoneThreshold({ kind }),
    value: params.threshold,
  });

  const copy = getLearnerMilestoneCopy({ kind, threshold });

  return (
    <StatsPageLayout
      breadcrumbItems={[
        { href: "/stats/engagement", label: "Engagement & Learning" },
        { label: "Learner Milestones" },
      ]}
      showPeriodTabs={false}
      title={copy.pageTitle}
    >
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <p className="text-muted-foreground text-sm">{copy.tableCaption}</p>
        </header>

        <LearnerMilestoneThresholdForm
          inputLabel={copy.inputLabel}
          kind={kind}
          threshold={threshold}
        />

        <Suspense fallback={<LearnerMilestoneUsersSkeleton />} key={`${kind}-${threshold}`}>
          <LearnerMilestoneUsers
            emptyMessage={copy.emptyMessage}
            kind={kind}
            params={params}
            threshold={threshold}
          />
        </Suspense>
      </div>
    </StatsPageLayout>
  );
}

/**
 * The page-level fallback covers the query-derived heading and threshold form
 * as well as the independently streamed user table.
 */
function LearnerMilestoneUsersPageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-4 w-80 max-w-full" />
      <Skeleton className="h-16 w-full rounded-lg" />
      <LearnerMilestoneUsersSkeleton />
    </div>
  );
}
