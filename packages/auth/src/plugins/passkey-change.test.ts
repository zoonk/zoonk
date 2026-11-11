import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { betterAuth } from "better-auth/minimal";
import { describe, expect, it } from "vitest";
import { BETTER_AUTH_BASE_PATH } from "../config";
import {
  passkeyFixture,
  signApproval,
  signRegistration,
} from "../passkeys/_test-utils/passkey-authenticator";
import { PASSKEY_REGISTRATION_ORIGIN as ORIGIN } from "../passkeys/relying-party";
import {
  type RestoreKeyAuthenticator,
  makeRestoreKey,
} from "../restore-keys/_test-utils/restore-key-authenticator";
import { baseAuthConfig, baseAuthPlugins, fullPlugins } from "../server";

const auth = betterAuth({
  ...baseAuthConfig,
  baseURL: ORIGIN,
  emailAndPassword: {
    enabled: true,
    password: {
      hash: async (password) => password,
      verify: async ({ hash, password }) => hash === password,
    },
  },
  plugins: [...baseAuthPlugins, ...fullPlugins],
  rateLimit: { enabled: false },
  secret: "passkey-change-plugin-test-secret-with-enough-entropy",
});

type Change = { action: "add" } | { action: "delete"; passkeyId: string };

/** A signed-in browser: every request carries the cookies the earlier ones set, as a page's do. */
async function signUp() {
  const cookies = new Map<string, string>();

  async function request(path: string, body?: unknown) {
    const response = await auth.handler(
      new Request(`${ORIGIN}${BETTER_AUTH_BASE_PATH}${path}`, {
        body: body ? JSON.stringify(body) : undefined,
        headers: {
          "content-type": "application/json",
          cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join("; "),
          origin: ORIGIN,
        },
        method: body ? "POST" : "GET",
      }),
    );

    for (const cookie of response.headers.getSetCookie()) {
      const [pair = ""] = cookie.split(";");
      cookies.set(pair.slice(0, pair.indexOf("=")), pair.slice(pair.indexOf("=") + 1));
    }

    const json: unknown = await response.json().catch(() => null);
    return { body: json, status: response.status };
  }

  const { body } = await request("/sign-up/email", {
    email: `passkey-change-${randomUUID()}@example.test`,
    name: "Staff",
    password: "passkey-change-password",
  });

  const { user } = body as { user: { id: string } };

  async function register(key: RestoreKeyAuthenticator) {
    const options = await request("/passkey/generate-register-options");

    if (options.status !== 200) {
      return options;
    }

    const { challenge } = options.body as { challenge: string };

    return request("/passkey/verify-registration", {
      response: signRegistration({ challenge, key, origin: ORIGIN }),
    });
  }

  async function confirm(change: Change, key: RestoreKeyAuthenticator, userVerified = true) {
    const { body: started } = await request("/passkey-change/options", change);
    const { options } = started as { options: { challenge: string } };

    return request("/passkey-change/approval", {
      assertion: signApproval({ challenge: options.challenge, key, origin: ORIGIN, userVerified }),
      change,
    });
  }

  async function passkeys() {
    return prisma.passkey.findMany({ orderBy: { createdAt: "asc" }, where: { userId: user.id } });
  }

  return { confirm, passkeys, register, request, userId: user.id };
}

describe("passkey changes", () => {
  it("takes an account's first passkey with the session alone, and no second one without a confirmation", async () => {
    const browser = await signUp();

    await expect(
      browser.request("/passkey-change/options", { action: "add" }),
    ).resolves.toStrictEqual({ body: { options: null }, status: 200 });

    await expect(browser.register(makeRestoreKey())).resolves.toMatchObject({ status: 200 });

    await expect(browser.register(makeRestoreKey())).resolves.toMatchObject({
      body: { code: "PASSKEY_CONFIRMATION_REQUIRED" },
      status: 403,
    });

    await expect(browser.passkeys()).resolves.toHaveLength(1);
  });

  it("adds one more passkey for each confirmation from an existing one", async () => {
    const browser = await signUp();
    const first = makeRestoreKey();
    await browser.register(first);

    await expect(browser.confirm({ action: "add" }, first)).resolves.toMatchObject({ status: 200 });
    await expect(browser.register(makeRestoreKey())).resolves.toMatchObject({ status: 200 });
    await expect(browser.register(makeRestoreKey())).resolves.toMatchObject({ status: 403 });
    await expect(browser.passkeys()).resolves.toHaveLength(2);
  });

  it("refuses a confirmation without user verification, from another person's passkey, or used twice", async () => {
    const [browser, stranger] = await Promise.all([signUp(), signUp()]);
    const first = makeRestoreKey();
    const theirs = makeRestoreKey();
    await Promise.all([browser.register(first), stranger.register(theirs)]);
    const change = { action: "add" } as const;

    await expect(browser.confirm(change, first, false)).resolves.toMatchObject({
      body: { code: "PASSKEY_CONFIRMATION_INVALID" },
      status: 403,
    });

    await expect(browser.confirm(change, theirs)).resolves.toMatchObject({ status: 403 });

    const { body } = await browser.request("/passkey-change/options", change);
    const { options } = body as { options: { challenge: string } };
    const assertion = signApproval({ challenge: options.challenge, key: first, origin: ORIGIN });
    const approval = { assertion, change };

    await expect(browser.request("/passkey-change/approval", approval)).resolves.toMatchObject({
      status: 200,
    });

    await expect(browser.request("/passkey-change/approval", approval)).resolves.toMatchObject({
      status: 403,
    });
  });

  it("refuses a registration started before the account had its first passkey", async () => {
    const browser = await signUp();
    const started = await browser.request("/passkey/generate-register-options");
    const { challenge } = started.body as { challenge: string };
    await passkeyFixture(browser.userId);

    await expect(
      browser.request("/passkey/verify-registration", {
        response: signRegistration({ challenge, key: makeRestoreKey(), origin: ORIGIN }),
      }),
    ).resolves.toMatchObject({ body: { code: "PASSKEY_CONFIRMATION_REQUIRED" }, status: 403 });

    await expect(browser.passkeys()).resolves.toHaveLength(1);
  });

  it("deletes only the passkey a confirmation names", async () => {
    const browser = await signUp();
    const first = makeRestoreKey();
    await browser.register(first);
    await browser.confirm({ action: "add" }, first);
    await browser.register(makeRestoreKey());
    const [kept, deleted] = await browser.passkeys();

    if (!kept || !deleted) {
      throw new Error("Expected two passkeys");
    }

    await expect(
      browser.request("/passkey/delete-passkey", { id: deleted.id }),
    ).resolves.toMatchObject({ body: { code: "PASSKEY_CONFIRMATION_REQUIRED" }, status: 403 });

    await browser.confirm({ action: "delete", passkeyId: deleted.id }, first);

    await expect(
      browser.request("/passkey/delete-passkey", { id: kept.id }),
    ).resolves.toMatchObject({ status: 403 });

    await expect(
      browser.request("/passkey/delete-passkey", { id: deleted.id }),
    ).resolves.toMatchObject({ status: 200 });

    await expect(browser.passkeys()).resolves.toMatchObject([{ id: kept.id }]);
  });
});

describe("staff authority", () => {
  it.each(["/admin/set-role", "/admin/update-user", "/admin/create-user"] as const)(
    "blocks the unused authority-changing endpoint %s",
    async (path) => {
      const admin = await signUp();
      await prisma.user.update({ data: { role: "admin" }, where: { id: admin.userId } });
      await admin.register(makeRestoreKey());
      const agent = await signUp();
      await agent.register(makeRestoreKey());
      const email = `blocked-staff-${randomUUID()}@example.test`;

      const bodies = {
        "/admin/create-user": { email, name: "Agent", role: "admin" },
        "/admin/set-role": { role: "admin", userId: agent.userId },
        "/admin/update-user": { data: { role: "admin" }, userId: agent.userId },
      };

      const body = bodies[path];

      await expect(admin.request(path, body)).resolves.toMatchObject({ status: 403 });

      await expect(
        prisma.user.findUniqueOrThrow({ where: { id: agent.userId } }),
      ).resolves.toMatchObject({ role: "user" });

      await expect(prisma.user.findUnique({ where: { email } })).resolves.toBeNull();
    },
  );

  it("refuses impersonation of an admin but allows impersonation of a learner", async () => {
    const admin = await signUp();
    const target = await signUp();

    await prisma.user.updateMany({
      data: { role: "admin" },
      where: { id: { in: [admin.userId, target.userId] } },
    });

    await expect(
      admin.request("/admin/impersonate-user", { userId: target.userId }),
    ).resolves.toMatchObject({ status: 403 });

    const learner = await signUp();

    await expect(
      admin.request("/admin/impersonate-user", { userId: learner.userId }),
    ).resolves.toMatchObject({ status: 200 });
  });
});
