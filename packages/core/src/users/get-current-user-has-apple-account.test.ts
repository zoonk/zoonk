import { appleAccountFixture } from "@zoonk/testing/fixtures/accounts";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getCurrentUserHasAppleAccount } from "./get-current-user-has-apple-account";

vi.mock("./get-session", () => ({ getSession: vi.fn() }));

describe(getCurrentUserHasAppleAccount, () => {
  beforeEach(() => {
    mockSession(null);
  });

  it("returns null for a guest", async () => {
    await expect(getCurrentUserHasAppleAccount()).resolves.toBeNull();
  });

  it("returns false when the current user has no Apple account", async () => {
    const user = await userFixture();
    mockSession(user.id);

    await expect(getCurrentUserHasAppleAccount()).resolves.toBe(false);
  });

  it("returns true when the current user has an Apple account", async () => {
    const user = await userFixture();
    mockSession(user.id);

    await appleAccountFixture({ userId: user.id });

    await expect(getCurrentUserHasAppleAccount()).resolves.toBe(true);
  });
});
