import { randomUUID } from "node:crypto";
import { auth } from "@zoonk/auth";
import { type User, prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { logError } from "@zoonk/utils/logger";
import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getUserSessionCacheTag } from "../cache/tags";
import { getCurrentUser, suggestCurrentUsername, updateCurrentUser } from "./current-user";

/** Only Next's request scope is replaced; Better Auth's session, endpoint and database hooks run. */
vi.unmock("./get-session");
vi.mock("@zoonk/auth", () => import("../../../auth/src/testing"));

async function signIn(user: User & { password: string }) {
  const signedIn = await auth.api.signInEmail({
    body: { email: user.email, password: user.password },
    returnHeaders: true,
  });

  const cookie = signedIn.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");

  const requestHeaders = new Headers({ cookie });
  vi.mocked(headers).mockResolvedValue(requestHeaders);

  return { headers: requestHeaders, token: signedIn.response.token };
}

describe("current user", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(auth.api, "updateUser");
    vi.mocked(headers).mockResolvedValue(new Headers());
  });

  describe(getCurrentUser, () => {
    it("returns null for a guest", async () => {
      await expect(getCurrentUser()).resolves.toBeNull();
    });

    it("returns the authenticated user's public account fields", async () => {
      const [user, otherUser] = await Promise.all([userFixture(), userFixture()]);
      await signIn(user);

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
      await signIn(user);

      const result = await updateCurrentUser({
        input: { name: "After", username: username.toUpperCase() },
      });

      expect(auth.api.updateUser).toHaveBeenCalledExactlyOnceWith({
        body: { name: "After", username },
        headers: await headers(),
      });

      expect(result).toMatchObject({ id: user.id, name: "After", username });

      await expect(
        prisma.user.findUniqueOrThrow({ where: { id: user.id } }),
      ).resolves.toMatchObject({ learnerRevision: 1n });

      expect(revalidateTag).toHaveBeenCalledExactlyOnceWith(getUserSessionCacheTag(user.id), {
        expire: 0,
      });
    });

    it("marks a bearer-only update through the production auth plugins", async () => {
      const user = await userFixture({ name: "Before" });
      const { token } = await signIn(user);
      const production = await vi.importActual<{ auth: typeof auth }>("@zoonk/auth");

      /** Run real production endpoints, including bearer conversion; only Next lacks a request. */
      vi.spyOn(auth.api, "getSession").mockImplementation(production.auth.api.getSession);
      vi.mocked(auth.api.updateUser).mockImplementation(production.auth.api.updateUser);
      vi.mocked(headers).mockResolvedValue(new Headers({ authorization: `Bearer ${token}` }));

      await expect(
        updateCurrentUser({ input: { name: "Bearer identity" } }),
      ).resolves.toMatchObject({ id: user.id, name: "Bearer identity" });

      await expect(
        prisma.user.findUniqueOrThrow({ where: { id: user.id } }),
      ).resolves.toMatchObject({ learnerRevision: 1n, name: "Bearer identity" });
    });

    it("keeps the core actor and production auth writer on bearer B when cookie A is present", async () => {
      const [cookieUser, bearerUser] = await Promise.all([userFixture(), userFixture()]);
      const cookieSession = await signIn(cookieUser);
      const bearerSession = await signIn(bearerUser);
      const production = await vi.importActual<{ auth: typeof auth }>("@zoonk/auth");
      const requestHeaders = new Headers(cookieSession.headers);
      requestHeaders.set("authorization", `Bearer ${bearerSession.token}`);
      vi.spyOn(auth.api, "getSession").mockImplementation(production.auth.api.getSession);
      vi.mocked(auth.api.updateUser).mockImplementation(production.auth.api.updateUser);
      vi.mocked(headers).mockResolvedValue(requestHeaders);

      await expect(updateCurrentUser({ input: { name: "Bearer B" } })).resolves.toMatchObject({
        id: bearerUser.id,
        name: "Bearer B",
      });

      await expect(
        prisma.user.findUniqueOrThrow({ where: { id: cookieUser.id } }),
      ).resolves.toMatchObject({ learnerRevision: 0n, name: cookieUser.name });

      await expect(
        prisma.user.findUniqueOrThrow({ where: { id: bearerUser.id } }),
      ).resolves.toMatchObject({ learnerRevision: 1n, name: "Bearer B" });
    });

    it("does not write a username that has not changed", async () => {
      const fixtureUser = await userFixture({ name: "Before" });
      const username = `same_${randomUUID().slice(0, 8)}`;
      await prisma.user.update({ data: { username }, where: { id: fixtureUser.id } });
      await signIn(fixtureUser);

      await updateCurrentUser({ input: { name: "After", username } });

      expect(auth.api.updateUser).toHaveBeenCalledExactlyOnceWith({
        body: { name: "After" },
        headers: await headers(),
      });
    });

    it("does not write or mark a canonically unchanged username", async () => {
      const fixtureUser = await userFixture({ name: "Kept" });
      const username = `kept_${randomUUID().slice(0, 8)}`;
      const user = await prisma.user.update({ data: { username }, where: { id: fixtureUser.id } });
      await signIn(fixtureUser);

      await updateCurrentUser({ input: { name: "Kept", username: ` ${username.toUpperCase()} ` } });

      expect(auth.api.updateUser).not.toHaveBeenCalled();

      await expect(
        prisma.user.findUniqueOrThrow({ where: { id: user.id } }),
      ).resolves.toMatchObject({ learnerRevision: 0n, name: "Kept", username });
    });

    it("does not mutate a user for a guest", async () => {
      await expect(updateCurrentUser({ input: { name: "No actor" } })).resolves.toBeNull();
      expect(auth.api.updateUser).not.toHaveBeenCalled();
    });

    it("does not mark unchanged input or a failed Better Auth write", async () => {
      const user = await userFixture({ name: "Kept" });
      await signIn(user);
      await updateCurrentUser({ input: { name: "Kept" } });
      expect(auth.api.updateUser).not.toHaveBeenCalled();

      await expect(
        updateCurrentUser({ input: { name: "Refused", username: "!" } }),
      ).rejects.toMatchObject({ statusCode: 400 });

      await expect(
        prisma.user.findUniqueOrThrow({ where: { id: user.id } }),
      ).resolves.toMatchObject({ learnerRevision: 0n, name: "Kept" });
    });

    it("preserves a successful identity write when its separate revision mark fails", async () => {
      const user = await userFixture({ name: "Before" });
      const maximumRevision = 9_223_372_036_854_775_807n;

      await prisma.user.update({
        data: { learnerRevision: maximumRevision },
        where: { id: user.id },
      });

      await signIn(user);

      await expect(updateCurrentUser({ input: { name: "Saved" } })).resolves.toMatchObject({
        id: user.id,
        name: "Saved",
      });

      await expect(
        prisma.user.findUniqueOrThrow({ where: { id: user.id } }),
      ).resolves.toMatchObject({ learnerRevision: maximumRevision, name: "Saved" });

      expect(logError).toHaveBeenCalledExactlyOnceWith(
        "[learnerIdentity] The identity update succeeded but its learner revision could not be marked",
        expect.objectContaining({ code: "P2010", message: expect.stringContaining("22003") }),
      );

      expect(revalidateTag).toHaveBeenCalledWith(getUserSessionCacheTag(user.id), { expire: 0 });
    });
  });

  describe(suggestCurrentUsername, () => {
    it("suggests a free username from the email to an account without one", async () => {
      const prefix = `setup${randomUUID().slice(0, 8)}`;

      const [user, other] = await Promise.all([
        userFixture({ email: `${prefix}@zoonk.test`, name: "" }),
        userFixture({ email: `${prefix}@other.test` }),
      ]);

      await prisma.user.update({ data: { username: prefix }, where: { id: other.id } });
      await signIn(user);

      await expect(suggestCurrentUsername()).resolves.toMatch(new RegExp(`^${prefix}_\\d+$`, "u"));

      expect(auth.api.updateUser).not.toHaveBeenCalled();
    });

    it("suggests the username the account already has", async () => {
      const user = await userFixture({ name: "" });
      const username = `kept_${randomUUID().slice(0, 8)}`;
      await prisma.user.update({ data: { username }, where: { id: user.id } });
      await signIn(user);

      await expect(suggestCurrentUsername()).resolves.toBe(username);
    });

    it("suggests nothing without a session", async () => {
      await expect(suggestCurrentUsername()).resolves.toBeNull();
    });
  });
});
