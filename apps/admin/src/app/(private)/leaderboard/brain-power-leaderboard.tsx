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

const LEADERBOARD_DAYS = 7;
const SKELETON_ROW_COUNT = 5;
const TABLE_COLUMN_COUNT = 4;

/**
 * The leaderboard stays server-rendered so ranking and pagination are resolved
 * together from URL state that can be refreshed or shared.
 */
export async function BrainPowerLeaderboard({
  searchParams,
}: {
  searchParams: PageProps<"/leaderboard">["searchParams"];
}) {
  const params = await searchParams;
  const { limit, offset, page } = parseSearchParams(params);

  const { currentPeriodStart } = getRollingUtcDateWindowStarts({
    days: LEADERBOARD_DAYS,
    now: new Date(),
  });

  const { leaders, total } = await listBrainPowerLeaders({
    limit,
    offset,
    startDate: currentPeriodStart,
  });

  const totalPages = Math.ceil(total / limit);

  return (
    <>
      <p className="text-muted-foreground text-sm">
        {total.toLocaleString()} users earned Brain Power in the past 7 days.
      </p>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableCaption className="sr-only">
            Brain Power leaderboard for the past 7 days
          </TableCaption>
          <BrainPowerLeaderboardHeader />

          <TableBody>
            {leaders.length > 0 ? (
              leaders.map((leader) => (
                <BrainPowerLeaderboardRow key={leader.user.id} leader={leader} />
              ))
            ) : (
              <BrainPowerLeaderboardEmptyRow />
            )}
          </TableBody>
        </Table>
      </div>

      <AdminPagination basePath="/leaderboard" limit={limit} page={page} totalPages={totalPages} />
    </>
  );
}

/**
 * The fallback matches the loaded table structure so the page remains stable
 * while grouped Brain Power totals are loading.
 */
export function BrainPowerLeaderboardSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-4 w-56" />

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <BrainPowerLeaderboardHeader />

          <TableBody>
            {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
              // oxlint-disable-next-line react/no-array-index-key -- Skeleton rows are static placeholders.
              <BrainPowerLeaderboardSkeletonRow key={index} />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/**
 * The loaded and loading tables share column labels and alignment so their
 * layout cannot drift as the leaderboard evolves.
 */
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

/**
 * An empty row keeps the table visible when no one earned Brain Power during
 * the rolling window, making the absence of activity explicit.
 */
function BrainPowerLeaderboardEmptyRow() {
  return (
    <TableRow>
      <TableCell className="text-muted-foreground" colSpan={TABLE_COLUMN_COUNT}>
        No Brain Power earned in the past 7 days.
      </TableCell>
    </TableRow>
  );
}

/**
 * Each leaderboard row links the user identity to account detail while keeping
 * the rank and Brain Power total aligned for quick comparison.
 */
function BrainPowerLeaderboardRow({ leader }: { leader: BrainPowerLeader }) {
  return (
    <TableRow>
      <TableCell className="text-muted-foreground text-right tabular-nums">
        {leader.rank.toLocaleString()}
      </TableCell>
      <TableCell>
        <Link className="block" href={`/users/${leader.user.id}`}>
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

/**
 * Placeholder cells mirror the loaded row widths closely enough to avoid a
 * noticeable shift when the leaderboard streams into the page.
 */
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
