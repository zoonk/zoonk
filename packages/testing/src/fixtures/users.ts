import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";

type UserAttrs = {
  email: string;
  name: string;
  role: "user" | "admin";
  password: string;
};

function userAttrs(attrs?: Partial<UserAttrs>): UserAttrs {
  return {
    email: attrs?.email || `testuser${randomUUID()}@example.test`,
    name: attrs?.name || "Test User",
    password: attrs?.password || "Testuser123!",
    role: attrs?.role || "user",
    ...attrs,
  };
}

/**
 * Create a credential user directly with Prisma for tests.
 * Tests need a user row plus a credential account row so `signInAs()` can
 * authenticate through Better Auth. Writing the same database shape directly
 * keeps this fixture fast and avoids pulling the auth runtime into callers
 * that only need seeded data. We also assign explicit string IDs here because
 * these rows bypass Better Auth's own insert path.
 */
export async function userFixture(attrs?: Partial<UserAttrs>) {
  const params = userAttrs(attrs);
  const user = await prisma.user.create({
    data: {
      accounts: {
        create: {
          accountId: params.email,
          id: randomUUID(),
          password: params.password,
          providerId: "credential",
        },
      },
      email: params.email,
      id: randomUUID(),
      name: params.name,
      role: params.role,
    },
  });

  return { ...user, password: params.password };
}
