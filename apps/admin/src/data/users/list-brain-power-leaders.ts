import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { type User, prisma } from "@zoonk/db";

export type BrainPowerLeader = { brainPower: number; rank: number; user: User };

type BrainPowerByUser = Awaited<ReturnType<typeof listBrainPowerByUser>>[number];

/** Positional arguments, since React's request memoization compares argument identity. */
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

function getBrainPowerProgressWhere({ startDate }: { startDate: Date }) {
  return { brainPowerEarned: { gt: 0 }, date: { gte: startDate } };
}

/** Prisma can rank the grouped totals but can't include each user in the same group query. */
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

/** An admin can delete a user between the two queries, so a missing account is left out. */
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
