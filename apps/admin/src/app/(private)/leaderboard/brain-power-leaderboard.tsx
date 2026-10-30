import { AdminTableSkeletonRows } from "@/components/admin-table-skeleton";
import { AdminPagination } from "@/components/pagination";
import {
  type BrainPowerLeader,
  listBrainPowerLeaders,
} from "@/data/users/list-brain-power-leaders";
import { parseSearchParams } from "@/lib/parse-search-params";
import { getRollingUtcDateWindowStarts } from "@/lib/rolling-date-windows";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zoonk/ui/components/table";
import Link from "next/link";
import {
  type LeaderboardPeriod,
  getLeaderboardPeriodDays,
  leaderboardPeriodDescriptions,
  parseLeaderboardPeriod,
} from "./leaderboard-period";

const TABLE_COLUMN_COUNT = 4;

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

  const totalPages = Math.ceil(total / limit);
  const periodDescription = leaderboardPeriodDescriptions[period];
  const userCountLabel = getLeaderboardUserCountLabel(total);

  return (
    <>
      <p className="text-muted-foreground text-sm">
        {total.toLocaleString()} {userCountLabel} earned Brain Power {periodDescription}.
      </p>

      <Table>
        <TableCaption className="sr-only">Brain Power leaderboard {periodDescription}</TableCaption>
        <BrainPowerLeaderboardHeader />

        <TableBody>
          {leaders.length > 0 ? (
            leaders.map((leader) => (
              <BrainPowerLeaderboardRow key={leader.user.id} leader={leader} />
            ))
          ) : (
            <BrainPowerLeaderboardEmptyRow periodDescription={periodDescription} />
          )}
        </TableBody>
      </Table>

      <AdminPagination
        basePath="/leaderboard"
        limit={limit}
        page={page}
        queryParams={{ period: period === "today" ? undefined : period }}
        totalPages={totalPages}
      />
    </>
  );
}

function getLeaderboardUserCountLabel(total: number): "user" | "users" {
  return total === 1 ? "user" : "users";
}

export function BrainPowerLeaderboardSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-4 w-56" />

      <Table>
        <BrainPowerLeaderboardHeader />

        <AdminTableSkeletonRows>
          <BrainPowerLeaderboardSkeletonRow />
        </AdminTableSkeletonRows>
      </Table>
    </div>
  );
}

function BrainPowerLeaderboardHeader() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead className="w-16 text-right">Rank</TableHead>
        <TableHead>User</TableHead>
        <TableHead>Username</TableHead>
        <TableHead className="text-right">Brain Power</TableHead>
      </TableRow>
    </TableHeader>
  );
}

function BrainPowerLeaderboardEmptyRow({ periodDescription }: { periodDescription: string }) {
  return (
    <TableRow>
      <TableCell className="text-muted-foreground" colSpan={TABLE_COLUMN_COUNT}>
        No Brain Power earned {periodDescription}.
      </TableCell>
    </TableRow>
  );
}

function BrainPowerLeaderboardRow({ leader }: { leader: BrainPowerLeader }) {
  return (
    <TableRow>
      <TableCell className="text-muted-foreground text-right tabular-nums">
        {leader.rank.toLocaleString()}
      </TableCell>
      <TableCell>
        <Link className="block" href={`/users/${leader.user.id}`} prefetch>
          <span className="font-medium">{leader.user.name || "—"}</span>
          <span className="text-muted-foreground block text-xs">{leader.user.email}</span>
        </Link>
      </TableCell>
      <TableCell>{leader.user.username || "—"}</TableCell>
      <TableCell className="text-right font-medium tabular-nums">
        {leader.brainPower.toLocaleString()}
      </TableCell>
    </TableRow>
  );
}

function BrainPowerLeaderboardSkeletonRow() {
  return (
    <TableRow>
      <TableCell>
        <Skeleton className="ml-auto h-4 w-6" />
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-24" />
      </TableCell>
      <TableCell>
        <Skeleton className="ml-auto h-4 w-16" />
      </TableCell>
    </TableRow>
  );
}
