import { AdminPagination } from "@/components/pagination";
import { listLearnerMilestoneUsers } from "@/data/stats/get-learner-milestones";
import { type LearnerMilestoneKind } from "@/lib/learner-milestone-filters";
import { parseSearchParams } from "@/lib/parse-search-params";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import {
  LearnerMilestoneUsersTable,
  LearnerMilestoneUsersTableSkeleton,
} from "./learner-milestone-users-table";

export function LearnerMilestoneUsers({
  emptyMessage,
  kind,
  params,
  threshold,
}: {
  emptyMessage: string;
  kind: LearnerMilestoneKind;
  params: Awaited<PageProps<"/stats/engagement/learners">["searchParams"]>;
  threshold: number;
}) {
  const { limit, offset, page } = parseSearchParams(params);

  return (
    <CachedLearnerMilestoneUsers
      emptyMessage={emptyMessage}
      kind={kind}
      limit={limit}
      offset={offset}
      page={page}
      threshold={threshold}
    />
  );
}

/** Normalized values stay stable across both runtime-prefetch passes, unlike the raw search params. */
async function CachedLearnerMilestoneUsers({
  emptyMessage,
  kind,
  limit,
  offset,
  page,
  threshold,
}: {
  emptyMessage: string;
  kind: LearnerMilestoneKind;
  limit: number;
  offset: number;
  page: number;
  threshold: number;
}) {
  "use cache: private";

  const { total, users } = await listLearnerMilestoneUsers(kind, threshold, limit, offset);
  const totalPages = Math.ceil(total / limit);

  return (
    <>
      <p className="text-muted-foreground text-sm">{total.toLocaleString()} matching users.</p>

      <LearnerMilestoneUsersTable emptyMessage={emptyMessage} users={users} />

      <AdminPagination
        basePath="/stats/engagement/learners"
        limit={limit}
        page={page}
        queryParams={{ kind, threshold: threshold.toString() }}
        totalPages={totalPages}
      />
    </>
  );
}

export function LearnerMilestoneUsersSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-4 w-32" />
      <LearnerMilestoneUsersTableSkeleton />
    </div>
  );
}
