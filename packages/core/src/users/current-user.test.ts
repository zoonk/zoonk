import { randomUUID } from "node:crypto";
import { auth } from "@zoonk/auth";
import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getUserSessionCacheTag } from "../cache/tags";
import { getCurrentUser, suggestCurrentUsername, updateCurrentUser } from "./current-user";

const authMocks = vi.hoisted(() => ({
  isUsernameAvailable:
    vi.fn<(input: { body: { username: string } }) => Promise<{ available: boolean }>>(),
  updateUser: vi.fn<(input: { body: { name?: string; username?: string } }) => Promise<void>>(),
}));

vi.mock("@zoonk/auth", () => ({
  auth: {
    api: { isUsernameAvailable: authMocks.isUsernameAvailable, updateUser: authMocks.updateUser },
  },
}));

vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("./get-session", () => ({ getSession: vi.fn() }));

describe("current user", () => {
  beforeEach(() => {
    vi.mocked(headers).mockResolvedValue(new Headers());
    mockSession(null);
  });

  describe(getCurrentUser, () => {
    it("returns null for a guest", async () => {
      await expect(getCurrentUser()).resolves.toBeNull();
    });

    it("returns the authenticated user's public account fields", async () => {
      const [user, otherUser] = await Promise.all([userFixture(), userFixture()]);
      mockSession(user.id);

      const currentUser = await getCurrentUser();

      expect(currentUser).toMatchObject({
        analyticsDisabled: user.analyticsDisabled,
        email: user.email,
        id: user.id,
        name: user.name,
        username: user.username,
      });

      expect(currentUser?.id).not.toBe(otherUser.id);
      expect(currentUser).not.toHaveProperty("stripeCustomerId");
    });
  });

  describe(updateCurrentUser, () => {
    it("updates the authenticated user and expires its cached resource", async () => {
      const user = await userFixture({ name: "Before" });
      const username = `after_${randomUUID().slice(0, 8)}`;
      mockSession(user.id);

      authMocks.updateUser.mockImplementation(async ({ body }) => {
        await prisma.user.update({ data: body, where: { id: user.id } });
      });

      const result = await updateCurrentUser({ input: { name: "After", username } });

      expect(auth.api.updateUser).toHaveBeenCalledExactlyOnceWith({
        body: { name: "After", username },
        headers: await headers(),
      });

      expect(result).toMatchObject({ id: user.id, name: "After", username });

      expect(revalidateTag).toHaveBeenCalledExactlyOnceWith(getUserSessionCacheTag(user.id), {
        expire: 0,
      });
    });

    it("does not write a username that has not changed", async () => {
      const fixtureUser = await userFixture({ name: "Before" });
      const username = `same_${randomUUID().slice(0, 8)}`;
      const user = await prisma.user.update({ data: { username }, where: { id: fixtureUser.id } });
      mockSession(user.id);

      authMocks.updateUser.mockImplementation(async ({ body }) => {
        await prisma.user.update({ data: body, where: { id: user.id } });
      });

      await updateCurrentUser({ input: { name: "After", username } });

      expect(auth.api.updateUser).toHaveBeenCalledExactlyOnceWith({
        body: { name: "After" },
        headers: await headers(),
      });
    });

    it("does not mutate a user for a guest", async () => {
      await expect(updateCurrentUser({ input: { name: "No actor" } })).resolves.toBeNull();
      expect(auth.api.updateUser).not.toHaveBeenCalled();
    });
  });

  describe(suggestCurrentUsername, () => {
    it("suggests a free username from the email to an account without one", async () => {
      const prefix = `setup${randomUUID().slice(0, 8)}`;
      const user = await userFixture({ email: `${prefix}@zoonk.test`, name: "" });
      await prisma.user.update({ data: { username: null }, where: { id: user.id } });
      mockSession(user.id);

      authMocks.isUsernameAvailable.mockImplementation(async ({ body }) => ({
        available: body.username !== prefix,
      }));

      await expect(suggestCurrentUsername()).resolves.toMatch(new RegExp(`^${prefix}_\\d+$`, "u"));

      expect(auth.api.updateUser).not.toHaveBeenCalled();
    });

    it("suggests the username the account already has", async () => {
      const user = await userFixture({ name: "" });
      const username = `kept_${randomUUID().slice(0, 8)}`;
      await prisma.user.update({ data: { username }, where: { id: user.id } });
      mockSession(user.id);

      await expect(suggestCurrentUsername()).resolves.toBe(username);
      expect(auth.api.isUsernameAvailable).not.toHaveBeenCalled();
    });

    it("suggests nothing without a session", async () => {
      await expect(suggestCurrentUsername()).resolves.toBeNull();
    });
  });
});
