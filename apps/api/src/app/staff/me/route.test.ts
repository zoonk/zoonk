import { auth } from "@zoonk/auth";
import { prisma } from "@zoonk/db";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { headers } from "next/headers";
import { describe, expect, it, vi } from "vitest";
import {
  cliTokenFixture,
  otherCliClientFixture,
} from "../../../../../../packages/auth/src/_test-utils/cli-tokens";
import { getAdminAccess } from "../../../../../../packages/core/src/users/get-admin-access";
import { GET as getMe } from "../../v1/me/route";
import { sendStaffAuthorization } from "../_test-utils/staff-authorization";
import { GET as getStaffMe } from "./route";

function whoami(authorization?: string) {
  sendStaffAuthorization(authorization);
  return getStaffMe();
}

async function adminFixture() {
  return userFixture({ name: "Staff Admin", role: "admin" });
}

describe("GET /staff/me", () => {
  it("answers who the CLI login belongs to", async () => {
    const admin = await adminFixture();
    const { accessToken } = await cliTokenFixture({ user: admin });

    const response = await whoami(`Bearer ${accessToken}`);

    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toStrictEqual({
      user: { email: admin.email, id: admin.id, name: "Staff Admin", role: "admin" },
    });
  });

  it.each([
    ["no token", undefined],
    ["a token that was never issued", "Bearer not-a-real-token"],
    ["another scheme", "Basic dXNlcjpwYXNz"],
  ])("refuses %s as unauthenticated", async (_case, authorization) => {
    const response = await whoami(authorization);

    expect(response.status).toBe(401);
  });

  it.each(["expired", "revoked"] as const)("refuses a %s token", async (state) => {
    const admin = await adminFixture();
    const { accessToken } = await cliTokenFixture({ state, user: admin });

    const response = await whoami(`Bearer ${accessToken}`);

    expect(response.status).toBe(401);
  });

  it("refuses another client's token as not the CLI's", async () => {
    const admin = await adminFixture();
    const clientId = await otherCliClientFixture();
    const { accessToken } = await cliTokenFixture({ clientId, user: admin });

    const response = await whoami(`Bearer ${accessToken}`);

    expect(response.status).toBe(401);
  });

  it("refuses a platform admin's browser session, by cookie or as a bearer token", async () => {
    const admin = await adminFixture();

    const signedIn = await auth.api.signInEmail({
      body: { email: admin.email, password: admin.password },
      returnHeaders: true,
    });

    const cookie = signedIn.headers
      .getSetCookie()
      .map((setCookie) => setCookie.split(";")[0])
      .join("; ");

    const bearer = `Bearer ${signedIn.response.token}`;

    sendStaffAuthorization(bearer);
    const product = await getMe();
    expect(product.status).toBe(200);

    const byBearer = await whoami(bearer);

    vi.mocked(headers).mockResolvedValue(new Headers({ cookie }));
    const byCookie = await getStaffMe();

    expect([byBearer.status, byCookie.status]).toStrictEqual([401, 401]);
  });

  it("refuses a learner's token", async () => {
    const learner = await userFixture();
    const { accessToken } = await cliTokenFixture({ user: learner });

    const response = await whoami(`Bearer ${accessToken}`);

    expect(response.status).toBe(403);
  });

  it("refuses an organization admin who isn't a platform admin", async () => {
    const [organization, brandAdmin] = await Promise.all([organizationFixture(), userFixture()]);

    await prisma.member.create({
      data: { organizationId: organization.id, role: "admin", userId: brandAdmin.id },
    });

    const { accessToken } = await cliTokenFixture({ user: brandAdmin });

    const response = await whoami(`Bearer ${accessToken}`);

    expect(response.status).toBe(403);
  });

  it("refuses an admin's token without staff:read", async () => {
    const admin = await adminFixture();
    const { accessToken } = await cliTokenFixture({ scopes: ["offline_access"], user: admin });

    const response = await whoami(`Bearer ${accessToken}`);

    expect(response.status).toBe(403);
  });

  it.each([
    ["banned", { banned: true }],
    ["no longer an admin", { role: "user" }],
  ])("refuses an admin's token once they're %s", async (_case, change) => {
    const admin = await adminFixture();
    const { accessToken } = await cliTokenFixture({ user: admin });

    await prisma.user.update({ data: change, where: { id: admin.id } });

    const response = await whoami(`Bearer ${accessToken}`);

    expect(response.status).toBe(403);
  });

  it("never lets a CLI token act as a session on product or admin routes", async () => {
    const admin = await adminFixture();
    const { accessToken } = await cliTokenFixture({ user: admin });

    sendStaffAuthorization(`Bearer ${accessToken}`);
    const product = await getMe();

    expect(product.status).toBe(401);
    await expect(getAdminAccess()).resolves.toBe("unauthorized");
  });
});
