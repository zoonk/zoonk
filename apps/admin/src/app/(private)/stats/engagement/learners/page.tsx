import {
  getDefaultLearnerMilestoneThreshold,
  getLearnerMilestoneCopy,
  parseLearnerMilestoneKind,
  parseLearnerMilestoneThreshold,
} from "@/lib/learner-milestone-filters";
import { type Metadata } from "next";
import { Suspense } from "react";
import { StatsPageLayout } from "../../_components/stats-page-layout";
import { LearnerMilestoneThresholdForm } from "./learner-milestone-threshold-form";
import { LearnerMilestoneUsers, LearnerMilestoneUsersSkeleton } from "./learner-milestone-users";

export const metadata: Metadata = { title: "Learner Milestones" };

export default async function LearnerMilestoneUsersPage({
  searchParams,
}: PageProps<"/stats/engagement/learners">) {
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
