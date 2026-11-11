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
import { revokeCliLoginForAdmin } from "./revoke-cli-login";

async function logInOnTwoMachines() {
  const admin = await userFixture({ role: "admin" });
  const lost = await cliTokenFixture({ user: admin });

  const lostLogin = await prisma.oauthRefreshToken.findFirstOrThrow({
    where: { userId: admin.id },
  });

  const kept = await cliTokenFixture({ user: admin });

  return { admin, kept, lost, lostLogin };
}

describe(revokeCliLoginForAdmin, () => {
  it("ends one machine's login and leaves the person's other machines logged in", async () => {
    const { admin, kept, lost, lostLogin } = await logInOnTwoMachines();
    mockAdminSession(admin.id);

    await expect(revokeCliLoginForAdmin(lostLogin.id)).resolves.toStrictEqual({ status: "ready" });

    await expect(isCliAccessTokenActive(lost.accessToken)).resolves.toBe(false);

    await expect(refreshCliLogin(String(lost.refreshToken))).rejects.toMatchObject({
      body: { error: "invalid_grant" },
    });

    await expect(isCliAccessTokenActive(kept.accessToken)).resolves.toBe(true);

    await expect(refreshCliLogin(String(kept.refreshToken))).resolves.toMatchObject({
      token_type: "Bearer",
    });
  });

  it("ends the access tokens a machine had before its last refresh", async () => {
    const admin = await userFixture({ role: "admin" });
    const lost = await cliTokenFixture({ user: admin });
    const refreshed = await refreshCliLogin(String(lost.refreshToken));

    const login = await prisma.oauthRefreshToken.findFirstOrThrow({
      where: { revoked: null, userId: admin.id },
    });

    mockAdminSession(admin.id);

    await expect(revokeCliLoginForAdmin(login.id)).resolves.toStrictEqual({ status: "ready" });
    await expect(isCliAccessTokenActive(lost.accessToken)).resolves.toBe(false);
    await expect(isCliAccessTokenActive(refreshed.access_token)).resolves.toBe(false);
  });

  it("says a login that refreshed since the list was read is no longer there", async () => {
    const { admin, lost, lostLogin } = await logInOnTwoMachines();
    mockAdminSession(admin.id);

    const refreshed = await refreshCliLogin(String(lost.refreshToken));

    await expect(revokeCliLoginForAdmin(lostLogin.id)).resolves.toStrictEqual({
      status: "notFound",
    });

    await expect(isCliAccessTokenActive(refreshed.access_token)).resolves.toBe(true);
  });

  it("lets only a platform admin revoke a login", async () => {
    const { lostLogin } = await logInOnTwoMachines();
    const learner = await userFixture();

    mockSession(learner.id);

    await expect(revokeCliLoginForAdmin(lostLogin.id)).resolves.toStrictEqual({
      status: "forbidden",
    });

    mockSession(null);

    await expect(revokeCliLoginForAdmin(lostLogin.id)).resolves.toStrictEqual({
      status: "unauthorized",
    });

    await expect(
      prisma.oauthRefreshToken.findUnique({ where: { id: lostLogin.id } }),
    ).resolves.not.toBeNull();
  });

  it("treats an id that isn't a login as not found", async () => {
    const admin = await userFixture({ role: "admin" });
    mockAdminSession(admin.id);

    await expect(revokeCliLoginForAdmin("not-an-id")).resolves.toStrictEqual({
      status: "notFound",
    });

    await expect(revokeCliLoginForAdmin(randomUUID())).resolves.toStrictEqual({
      status: "notFound",
    });
  });
});
