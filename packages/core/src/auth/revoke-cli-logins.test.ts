import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import {
  cliTokenFixture,
  isCliAccessTokenActive,
  refreshCliLogin,
} from "../../../auth/src/_test-utils/cli-tokens";
import { mockAdminSession, mockSession } from "../_test-utils/mock-session";
import { revokeCliLoginsForAdmin } from "./revoke-cli-logins";

describe(revokeCliLoginsForAdmin, () => {
  it("ends every CLI login the person has, even one that renewed after the list was read", async () => {
    const [admin, person] = await Promise.all([
      userFixture({ role: "admin" }),
      userFixture({ role: "admin" }),
    ]);

    const lost = await cliTokenFixture({ user: person });
    const otherMachine = await cliTokenFixture({ user: person });
    mockAdminSession(admin.id);

    const renewed = await refreshCliLogin(String(lost.refreshToken));

    await expect(revokeCliLoginsForAdmin(person.id)).resolves.toStrictEqual({ status: "ready" });

    await expect(
      Promise.all(
        [lost.accessToken, renewed.access_token, otherMachine.accessToken].map((token) =>
          isCliAccessTokenActive(token),
        ),
      ),
    ).resolves.toStrictEqual([false, false, false]);

    await expect(refreshCliLogin(String(renewed.refresh_token))).rejects.toMatchObject({
      body: { error: "invalid_grant" },
    });

    await expect(refreshCliLogin(String(otherMachine.refreshToken))).rejects.toMatchObject({
      body: { error: "invalid_grant" },
    });
  });

  it("leaves other people's CLI logins working", async () => {
    const [admin, person, someoneElse] = await Promise.all([
      userFixture({ role: "admin" }),
      userFixture({ role: "admin" }),
      userFixture({ role: "admin" }),
    ]);

    await cliTokenFixture({ user: person });
    const theirs = await cliTokenFixture({ user: someoneElse });
    mockAdminSession(admin.id);

    await revokeCliLoginsForAdmin(person.id);

    await expect(isCliAccessTokenActive(theirs.accessToken)).resolves.toBe(true);

    await expect(refreshCliLogin(String(theirs.refreshToken))).resolves.toMatchObject({
      token_type: "Bearer",
    });
  });

  it("lets only a platform admin revoke", async () => {
    const [person, learner] = await Promise.all([userFixture({ role: "admin" }), userFixture()]);

    const login = await cliTokenFixture({ user: person });

    mockSession(learner.id);

    await expect(revokeCliLoginsForAdmin(person.id)).resolves.toStrictEqual({
      status: "forbidden",
    });

    mockSession(null);

    await expect(revokeCliLoginsForAdmin(person.id)).resolves.toStrictEqual({
      status: "unauthorized",
    });

    await expect(isCliAccessTokenActive(login.accessToken)).resolves.toBe(true);
  });

  it("says when there's no login to end", async () => {
    const admin = await userFixture({ role: "admin" });
    mockAdminSession(admin.id);

    await expect(revokeCliLoginsForAdmin("not-an-id")).resolves.toStrictEqual({
      status: "notFound",
    });

    await expect(revokeCliLoginsForAdmin(randomUUID())).resolves.toStrictEqual({
      status: "notFound",
    });

    await expect(prisma.oauthRefreshToken.count({ where: { userId: admin.id } })).resolves.toBe(0);
  });
});
