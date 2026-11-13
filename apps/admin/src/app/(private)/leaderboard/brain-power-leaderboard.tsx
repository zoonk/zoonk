import { AdminSectionEmpty } from "@/components/admin-section";
import { AdminUserAvatar } from "@/components/admin-user-avatar";
import { BarList } from "@/components/bar-list";
import { AdminPagination } from "@/components/pagination";
import {
  type BrainPowerLeader,
  listBrainPowerLeaders,
} from "@/data/users/list-brain-power-leaders";
import { getLearnerLabel } from "@/lib/learner-label";
import { parseSearchParams } from "@/lib/parse-search-params";
import { getRollingUtcDateWindowStarts } from "@/lib/rolling-date-windows";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import Link from "next/link";
import {
  DEFAULT_LEADERBOARD_PERIOD,
  type LeaderboardPeriod,
  getLeaderboardPeriodDays,
  leaderboardPeriodDescriptions,
  parseLeaderboardPeriod,
} from "./leaderboard-period";

const SKELETON_ROWS = 8;

export async function BrainPowerLeaderboard({
  searchParams,
}: {
  searchParams: PageProps<"/leaderboard">["searchParams"];
}) {
  const params = await searchParams;
  const { limit, offset, page } = parseSearchParams(params);
  const period = parseLeaderboardPeriod(params.period);

  return <CachedBrainPowerLeaderboard limit={limit} offset={offset} page={page} period={period} />;
}

/** A learner's place, photo and name; the row opens their page. */
function LeaderName({ leader }: { leader: BrainPowerLeader }) {
  return (
    <Link
      className="hit-area relative flex min-w-0 items-center gap-3"
      href={`/users/${leader.user.id}`}
      prefetch
    >
      <span className="text-muted-foreground text-compact w-6 shrink-0 text-end font-mono tabular-nums">
        {leader.rank.toLocaleString("en")}
      </span>
      <AdminUserAvatar user={leader.user} />
      <span className="truncate font-medium">{getLearnerLabel(leader.user)}</span>
    </Link>
  );
}

/** Primitive props make each leaderboard state its own cache entry. */
async function CachedBrainPowerLeaderboard({
  limit,
  offset,
  page,
  period,
}: {
  limit: number;
  offset: number;
  page: number;
  period: LeaderboardPeriod;
}) {
  "use cache: private";

  const { currentPeriodStart } = getRollingUtcDateWindowStarts({
    days: getLeaderboardPeriodDays(period),
    // oxlint-disable-next-line react/purity -- A cached Server Component reads the time once per cache entry and never re-renders on the client.
    now: new Date(),
  });

  const { leaders, total } = await listBrainPowerLeaders({
    limit,
    offset,
    startDate: currentPeriodStart,
  });

  if (leaders.length === 0) {
    return (
      <AdminSectionEmpty>
        Nobody earned Brain Power {leaderboardPeriodDescriptions[period]}.
      </AdminSectionEmpty>
    );
  }

  return (
    <>
      <BarList
        rows={leaders.map((leader) => ({
          display: leader.brainPower.toLocaleString("en"),
          key: leader.user.id,
          name: <LeaderName leader={leader} />,
          value: leader.brainPower,
        }))}
      />

      <AdminPagination
        basePath="/leaderboard"
        limit={limit}
        page={page}
        queryParams={{ period: period === DEFAULT_LEADERBOARD_PERIOD ? undefined : period }}
        totalPages={Math.ceil(total / limit)}
      />
    </>
  );
}

export function BrainPowerLeaderboardSkeleton() {
  return (
    <div aria-hidden="true" className="divide-y">
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <div className="flex h-11 items-center gap-3" key={index}>
          <Skeleton className="h-3.5 w-6" />
          <Skeleton className="size-6 rounded-full" />
          <Skeleton className="h-3.5 w-40" />
        </div>
      ))}
    </div>
  );
}
