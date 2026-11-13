import { AdminPage, AdminPageBody, AdminPageHeader } from "@/components/admin-page";
import {
  getDefaultLearnerMilestoneThreshold,
  getLearnerMilestoneCopy,
  parseLearnerMilestoneKind,
  parseLearnerMilestoneThreshold,
} from "@/lib/learner-milestone-filters";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { Suspense } from "react";
import { LearnerMilestoneThresholdForm } from "./learner-milestone-threshold-form";
import { LearnerMilestoneUsers, LearnerMilestoneUsersSkeleton } from "./learner-milestone-users";

export const metadata: Metadata = { title: "Learner milestones" };

const ENGAGEMENT = { href: "/stats/engagement", label: "Engagement" };

export default function LearnerMilestoneUsersPage({
  searchParams,
}: PageProps<"/stats/engagement/learners">) {
  return (
    <Suspense
      fallback={
        <AdminPage>
          <AdminPageHeader parent={ENGAGEMENT} title="Learner milestones" />
          <AdminPageBody>
            <LearnerMilestoneUsersPageSkeleton />
          </AdminPageBody>
        </AdminPage>
      }
    >
      <LearnerMilestoneUsersPageContent searchParams={searchParams} />
    </Suspense>
  );
}

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
    <AdminPage>
      <AdminPageHeader parent={ENGAGEMENT} title={copy.pageTitle} />
      <AdminPageBody className="gap-6">
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
      </AdminPageBody>
    </AdminPage>
  );
}

function LearnerMilestoneUsersPageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-4 w-80 max-w-full" />
      <Skeleton className="h-16 w-full rounded-lg" />
      <LearnerMilestoneUsersSkeleton />
    </div>
  );
}
