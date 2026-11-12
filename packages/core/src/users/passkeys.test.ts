import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { passkeyFixture } from "../../../auth/src/passkeys/_test-utils/passkey-authenticator";
import { mockAdminSession, mockSession } from "../_test-utils/mock-session";
import { getPasskeys } from "./passkeys";

describe(getPasskeys, () => {
  it("lists a staff person's own passkeys and none of anyone else's", async () => {
    const [staff, other] = await Promise.all([
      userFixture({ role: "admin" }),
      userFixture({ role: "admin" }),
    ]);

    await Promise.all([passkeyFixture(staff.id), passkeyFixture(other.id)]);
    mockAdminSession(staff.id);

    await expect(getPasskeys()).resolves.toStrictEqual([
      { createdAt: expect.any(Date), id: expect.any(String), name: null },
    ]);
  });

  it("offers a learner and a visitor no passkeys", async () => {
    const learner = await userFixture();
    await passkeyFixture(learner.id);
    mockSession(learner.id);

    await expect(getPasskeys()).resolves.toBeNull();

    mockSession(null);

    await expect(getPasskeys()).resolves.toBeNull();
  });
});
