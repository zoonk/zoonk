import { AdminPage, AdminPageBody, AdminPageHeader, AdminToolbar } from "@/components/admin-page";
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

export const metadata: Metadata = { title: "Learners by what they completed" };

const ENGAGEMENT = { href: "/stats/engagement", label: "Engagement" };

export default function LearnerMilestoneUsersPage({
  searchParams,
}: PageProps<"/stats/engagement/learners">) {
  return (
    <Suspense
      fallback={
        <AdminPage>
          <AdminPageHeader parent={ENGAGEMENT} title="Learners by lessons completed" />
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
      <AdminPageHeader parent={ENGAGEMENT} title={copy.listTitle} />

      <AdminPageBody>
        <AdminToolbar>
          <LearnerMilestoneThresholdForm kind={kind} threshold={threshold} unit={copy.unit} />
        </AdminToolbar>

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
    <>
      <AdminToolbar>
        <div className="flex h-11 items-center">
          <Skeleton className="h-7.5 w-44 rounded-md" />
        </div>
      </AdminToolbar>
      <LearnerMilestoneUsersSkeleton />
    </>
  );
}
