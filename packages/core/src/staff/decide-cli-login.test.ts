import { STAFF_PROPOSE_SCOPE } from "@zoonk/auth/cli-login-contract";
import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { headers } from "next/headers";
import { describe, expect, it, vi } from "vitest";
import { claimedCliLoginFixture, redeemCliLogin } from "../../../auth/src/_test-utils/cli-tokens";
import { mockSession } from "../_test-utils/mock-session";
import { decideCliLogin } from "./decide-cli-login";

/** The approval page's request: the person's session, after its check claimed the code for them. */
async function claimAs(user: Awaited<ReturnType<typeof userFixture>>, scopes?: string[]) {
  const claimed = await claimedCliLoginFixture({ scopes, user });
  vi.mocked(headers).mockResolvedValue(claimed.browser);
  mockSession(user.id);
  return claimed;
}

describe(decideCliLogin, () => {
  it("lets a staff member approve the login they claimed, with the code typed in any case", async () => {
    const admin = await userFixture({ role: "admin" });
    const claimed = await claimAs(admin);

    await expect(
      decideCliLogin({ decision: "approve", userCode: claimed.userCode.toLowerCase() }),
    ).resolves.toStrictEqual({ status: "approved" });

    await expect(redeemCliLogin({ deviceCode: claimed.deviceCode })).resolves.toMatchObject({
      token_type: "Bearer",
    });
  });

  it("turns down a staff login for an account without staff access, so the CLI stops waiting", async () => {
    const learner = await userFixture();
    const claimed = await claimAs(learner);

    await expect(
      decideCliLogin({ decision: "approve", userCode: claimed.userCode }),
    ).resolves.toStrictEqual({ status: "needsStaff" });

    await expect(redeemCliLogin({ deviceCode: claimed.deviceCode })).rejects.toMatchObject({
      body: { error: "access_denied" },
    });
  });

  it("turns down a login that asks only to propose fixes for an account without staff access", async () => {
    const learner = await userFixture();
    const claimed = await claimAs(learner, [STAFF_PROPOSE_SCOPE, "offline_access"]);

    await expect(
      decideCliLogin({ decision: "approve", userCode: claimed.userCode }),
    ).resolves.toStrictEqual({ status: "needsStaff" });
  });

  it("lets anyone approve a login that doesn't ask for staff data", async () => {
    const learner = await userFixture();
    const claimed = await claimAs(learner, ["offline_access"]);

    await expect(
      decideCliLogin({ decision: "approve", userCode: claimed.userCode }),
    ).resolves.toStrictEqual({ status: "approved" });
  });

  it("denies a login when asked", async () => {
    const admin = await userFixture({ role: "admin" });
    const claimed = await claimAs(admin);

    await expect(
      decideCliLogin({ decision: "deny", userCode: claimed.userCode }),
    ).resolves.toStrictEqual({ status: "denied" });

    await expect(redeemCliLogin({ deviceCode: claimed.deviceCode })).rejects.toMatchObject({
      body: { error: "access_denied" },
    });
  });

  it("decides only a login this person claimed", async () => {
    const [admin, other] = await Promise.all([
      userFixture({ role: "admin" }),
      userFixture({ role: "admin" }),
    ]);

    const othersLogin = await claimedCliLoginFixture({ user: other });
    mockSession(admin.id);

    await expect(
      decideCliLogin({ decision: "approve", userCode: othersLogin.userCode }),
    ).resolves.toStrictEqual({ status: "notFound" });

    await expect(
      prisma.deviceCode.findUnique({ where: { userCode: othersLogin.userCode } }),
    ).resolves.toMatchObject({ status: "pending", userId: other.id });
  });

  it("asks a signed-out visitor to log in", async () => {
    mockSession(null);

    await expect(
      decideCliLogin({ decision: "approve", userCode: "ABCD2345" }),
    ).resolves.toStrictEqual({ status: "unauthorized" });
  });
});
