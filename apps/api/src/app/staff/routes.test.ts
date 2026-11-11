import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { cliTokenFixture } from "../../../../../packages/auth/src/_test-utils/cli-tokens";
import { signInStaff, staffRequest } from "./_test-utils/requests";
import { sendStaffAuthorization } from "./_test-utils/staff-authorization";
import { GET as getModels } from "./models/route";
import { POST as countRecords } from "./records/count/route";
import { POST as getRecord } from "./records/get/route";
import { POST as listRecords } from "./records/list/route";
import { POST as findUser } from "./users/find/route";
import { POST as searchUsers } from "./users/search/route";

const routes = [
  { call: () => getModels(), path: "/staff/models" },
  {
    call: () =>
      getRecord(
        staffRequest({ body: { id: randomUUID(), model: "User" }, path: "/staff/records/get" }),
      ),
    path: "/staff/records/get",
  },
  {
    call: () => listRecords(staffRequest({ body: { model: "User" }, path: "/staff/records/list" })),
    path: "/staff/records/list",
  },
  {
    call: () =>
      countRecords(staffRequest({ body: { model: "User" }, path: "/staff/records/count" })),
    path: "/staff/records/count",
  },
  {
    call: () =>
      findUser(staffRequest({ body: { query: "nobody@example.test" }, path: "/staff/users/find" })),
    path: "/staff/users/find",
  },
  {
    call: () =>
      searchUsers(
        staffRequest({ body: { query: "nobody@example.test" }, path: "/staff/users/search" }),
      ),
    path: "/staff/users/search",
  },
];

describe("staff route authorization", () => {
  it.each(routes)("$path refuses missing tokens and non-admin CLI logins", async ({ call }) => {
    sendStaffAuthorization();
    const missing = await call();
    expect(missing.status).toBe(401);

    const learner = await userFixture();
    const { accessToken } = await cliTokenFixture({ user: learner });
    sendStaffAuthorization(`Bearer ${accessToken}`);
    const forbidden = await call();
    expect(forbidden.status).toBe(403);

    await expect(forbidden.json()).resolves.toMatchObject({ error: { code: "FORBIDDEN" } });
  });

  it.each(routes)("$path rechecks the role on the next call", async ({ call }) => {
    const { user } = await signInStaff();
    const before = await call();
    expect([200, 404]).toContain(before.status);
    await prisma.user.update({ data: { role: "user" }, where: { id: user.id } });
    const after = await call();
    expect(after.status).toBe(403);
  });
});
