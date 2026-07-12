import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { type User, prisma } from "@zoonk/db";

export type BrainPowerLeader = { brainPower: number; rank: number; user: User };

type BrainPowerByUser = Awaited<ReturnType<typeof listBrainPowerByUser>>[number];

/**
 * The cached loader coordinates the ranked progress query, matching user count,
 * and account lookup while keeping its positional arguments stable for React's
 * request memoization.
 */
const cachedListBrainPowerLeaders = cacheAdminData(
  async (startDateIso: string, limit: number, offset: number) => {
    const startDate = new Date(startDateIso);

    const [brainPowerByUser, total] = await Promise.all([
      listBrainPowerByUser({ limit, offset, startDate }),
      prisma.user.count({
        where: { dailyProgress: { some: getBrainPowerProgressWhere({ startDate }) } },
      }),
    ]);

    const userIds = brainPowerByUser.map((row) => row.userId);
    const users = await prisma.user.findMany({ where: { id: { in: userIds } } });
    const leaders = mergeBrainPowerWithUsers({ brainPowerByUser, offset, users });

    return { leaders, total };
  },
);

/**
 * The leaderboard ranks users by Brain Power earned on or after the supplied
 * date. The start date stays explicit so the route owns what “past 7 days”
 * means and the cached database helper remains deterministic.
 */
export function listBrainPowerLeaders({
  limit,
  offset,
  startDate,
}: {
  limit: number;
  offset: number;
  startDate: Date;
}) {
  return cachedListBrainPowerLeaders(startDate.toISOString(), limit, offset);
}

/**
 * Grouping daily rows produces one ranked total per user. The user id provides
 * a deterministic tie-breaker so pagination cannot reorder equal BP totals
 * between requests.
 */
function listBrainPowerByUser({
  limit,
  offset,
  startDate,
}: {
  limit: number;
  offset: number;
  startDate: Date;
}) {
  return prisma.dailyProgress.groupBy({
    _sum: { brainPowerEarned: true },
    by: ["userId"],
    orderBy: [{ _sum: { brainPowerEarned: "desc" } }, { userId: "asc" }],
    skip: offset,
    take: limit,
    where: getBrainPowerProgressWhere({ startDate }),
  });
}

/**
 * The grouped ranking and qualifying-user count must use the same daily-row
 * boundary or pagination totals can disagree with the visible leaderboard.
 */
function getBrainPowerProgressWhere({ startDate }: { startDate: Date }) {
  return { brainPowerEarned: { gt: 0 }, date: { gte: startDate } };
}

/**
 * Prisma can rank the grouped progress totals but cannot include each user in
 * the same group query. Rebuilding rows from the ranked ids preserves the
 * database order after the account records are loaded separately.
 */
function mergeBrainPowerWithUsers({
  brainPowerByUser,
  offset,
  users,
}: {
  brainPowerByUser: Awaited<ReturnType<typeof listBrainPowerByUser>>;
  offset: number;
  users: User[];
}): BrainPowerLeader[] {
  const usersById = new Map(users.map((user) => [user.id, user]));

  return brainPowerByUser.flatMap((row, index) =>
    createBrainPowerLeader({ index, offset, row, usersById }),
  );
}

/**
 * A user can disappear between the grouped progress query and the account
 * lookup if an admin deletes it concurrently. Omitting that stale row keeps
 * the page usable instead of failing the whole leaderboard request.
 */
function createBrainPowerLeader({
  index,
  offset,
  row,
  usersById,
}: {
  index: number;
  offset: number;
  row: BrainPowerByUser;
  usersById: Map<string, User>;
}): BrainPowerLeader[] {
  const user = usersById.get(row.userId);

  if (!user) {
    return [];
  }

  return [{ brainPower: row._sum.brainPowerEarned ?? 0, rank: offset + index + 1, user }];
}
