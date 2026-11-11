import { getActiveSubscriptionQuery } from "@zoonk/auth/active-subscription";
import { type TransactionClient, type User } from "@zoonk/db";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { getUserSearchWhere } from "../users/user-search";
import { staffFindUserSchema, staffSearchUsersSchema } from "./input";
import { staffRead, staffTransaction } from "./read";

function userFacts(user: User) {
  return {
    banExpires: user.banExpires?.toISOString() ?? null,
    banReason: user.banReason,
    banned: user.banned,
    createdAt: user.createdAt.toISOString(),
    email: user.email,
    id: user.id,
    isAnonymous: user.isAnonymous,
    name: user.name,
    role: user.role,
    username: user.username,
  };
}

async function usersWithPlans({ client, users }: { client: TransactionClient; users: User[] }) {
  if (users.length === 0) {
    return [];
  }

  const now = new Date();
  const queries = users.map((user) => getActiveSubscriptionQuery({ now, userId: user.id }));
  const [first] = queries;

  const subscriptions = await client.subscription.findMany({
    orderBy: first?.orderBy,
    where: { OR: queries.map((query) => query.where) },
  });

  return users.map((user) => ({
    ...userFacts(user),
    effectivePlan:
      subscriptions.find((subscription) => subscription.referenceId === user.id)?.plan ?? "free",
  }));
}

export function findStaffUser(input: unknown) {
  return staffRead({
    call: { model: "User", verb: "users.find" },
    input,
    run: async ({ query }) => {
      const normalized = query.toLowerCase();
      const id = uuidSchema().safeParse(query);

      const user = await staffTransaction(async (client) => {
        const found = await client.user.findFirst({
          where: {
            OR: [
              { email: normalized },
              { username: normalized },
              ...(id.success ? [{ id: id.data }] : []),
            ],
          },
        });

        const [facts] = await usersWithPlans({ client, users: found ? [found] : [] });
        return facts ?? null;
      });

      return { data: { user }, rows: user === null ? 0 : 1 };
    },
    schema: staffFindUserSchema,
  });
}

export function searchStaffUsers(input: unknown) {
  return staffRead({
    call: { model: "User", verb: "users.search" },
    input,
    run: async ({ query, limit }) => {
      const users = await staffTransaction(async (client) => {
        const found = await client.user.findMany({
          orderBy: { id: "asc" },
          take: limit,
          where: getUserSearchWhere({ search: query }),
        });

        return usersWithPlans({ client, users: found });
      });

      return { data: { users }, rows: users.length };
    },
    schema: staffSearchUsersSchema,
  });
}
