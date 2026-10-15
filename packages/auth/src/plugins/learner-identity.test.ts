import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import * as logger from "@zoonk/utils/logger";
import { type BetterAuthPlugin } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { betterAuth } from "better-auth/minimal";
import { toNextJsHandler } from "better-auth/next-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fullPlugins } from "../server";
import { auth } from "../testing";

/** Keep the full production plugin chain, including bearer and the final Next cookie adapter.
 * Test accounts are created through testing.ts, so no external sign-up side effects run. */
const identityPlugins = [
  ...auth.options.plugins,
  ...fullPlugins.filter((plugin) => plugin.id !== "next-cookies"),
];

function createIdentityAuth({
  basePath = "/api/auth",
  plugins = [],
}: { basePath?: string; plugins?: BetterAuthPlugin[] } = {}) {
  return betterAuth({
    ...auth.options,
    basePath,
    plugins: [
      ...identityPlugins,
      ...plugins,
      ...fullPlugins.filter((plugin) => plugin.id === "next-cookies"),
    ],
    rateLimit: { enabled: false },
  });
}

const mainAuth = createIdentityAuth();
const apiAuth = createIdentityAuth({ basePath: "/v1/auth" });

type IdentityAuth = ReturnType<typeof createIdentityAuth>;

async function updateIdentity({
  basePath,
  body,
  headers,
  instance,
}: {
  basePath: string;
  body: Record<string, unknown>;
  headers: Headers;
  instance: IdentityAuth;
}) {
  const requestHeaders = new Headers(headers);
  requestHeaders.set("content-type", "application/json");
  const { POST: post } = toNextJsHandler(instance);

  return post(
    new Request(`http://localhost:3000${basePath}/update-user`, {
      body: JSON.stringify(body),
      headers: requestHeaders,
      method: "POST",
    }),
  );
}

async function signIn() {
  const signedIn = await auth.api.signUpEmail({
    body: {
      email: `identity-${randomUUID()}@example.test`,
      name: "Before",
      password: "identity-test-password",
    },
    returnHeaders: true,
  });

  const cookie = signedIn.headers
    .getSetCookie()
    .map((setCookie) => setCookie.split(";")[0])
    .join("; ");

  return {
    headers: new Headers({ cookie, origin: "http://localhost:3000" }),
    token: signedIn.response.token,
    user: signedIn.response.user,
  };
}

describe.each([
  { basePath: "/api/auth", instance: mainAuth },
  { basePath: "/v1/auth", instance: apiAuth },
])("learner identity at $basePath", ({ basePath, instance }) => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    { field: "name", value: "After" },
    { field: "image", value: "https://example.test/after.png" },
    { field: "username", value: `after_${randomUUID().slice(0, 8)}` },
  ])(
    "marks a successful mounted $field update exactly once and keeps identity cookies",
    async ({ field, value }) => {
      const { headers, user } = await signIn();

      const response = await updateIdentity({
        basePath,
        body: { [field]: value },
        headers,
        instance,
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toStrictEqual({ status: true });
      expect(response.headers.getSetCookie().length).toBeGreaterThan(0);

      const cookie = response.headers
        .getSetCookie()
        .map((setCookie) => setCookie.split(";")[0])
        .join("; ");

      const session = await instance.api.getSession({ headers: new Headers({ cookie }) });

      expect(session?.user).toMatchObject({ [field]: value, id: user.id });

      await expect(
        prisma.user.findUniqueOrThrow({ where: { id: user.id } }),
      ).resolves.toMatchObject({ [field]: value, learnerRevision: 1n });
    },
  );

  it("marks a bearer-only mounted identity update", async () => {
    const { token, user } = await signIn();

    const response = await updateIdentity({
      basePath,
      body: { name: "Bearer identity" },
      headers: new Headers({ authorization: `Bearer ${token}`, origin: "http://localhost:3000" }),
      instance,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toStrictEqual({ status: true });

    await expect(prisma.user.findUniqueOrThrow({ where: { id: user.id } })).resolves.toMatchObject({
      learnerRevision: 1n,
      name: "Bearer identity",
    });
  });

  it.each(["name", "username"])(
    "uses bearer B consistently when cookie A is also sent (%s)",
    async (field) => {
      const [cookieAccount, bearerAccount] = await Promise.all([signIn(), signIn()]);
      const headers = new Headers(cookieAccount.headers);
      headers.set("authorization", `Bearer ${bearerAccount.token}`);
      const username = `bearer_${randomUUID().slice(0, 8)}`;
      await prisma.user.update({ data: { username }, where: { id: bearerAccount.user.id } });
      const body = field === "username" ? { name: "Bearer B", username } : { name: "Bearer B" };
      const response = await updateIdentity({ basePath, body, headers, instance });

      expect(response.status).toBe(200);

      await expect(
        prisma.user.findUniqueOrThrow({ where: { id: cookieAccount.user.id } }),
      ).resolves.toMatchObject({ learnerRevision: 0n, name: "Before" });

      await expect(
        prisma.user.findUniqueOrThrow({ where: { id: bearerAccount.user.id } }),
      ).resolves.toMatchObject({ learnerRevision: 1n, name: "Bearer B" });
    },
  );

  it("marks clearing an existing image", async () => {
    const { headers, user } = await signIn();

    await prisma.user.update({
      data: { image: "https://example.test/before.png" },
      where: { id: user.id },
    });

    const response = await updateIdentity({ basePath, body: { image: null }, headers, instance });

    expect(response.status).toBe(200);

    await expect(prisma.user.findUniqueOrThrow({ where: { id: user.id } })).resolves.toMatchObject({
      image: null,
      learnerRevision: 1n,
    });
  });

  it("marks a redundant canonical provider update even when the session cookie is stale", async () => {
    const { headers, user } = await signIn();
    const username = `kept_${randomUUID().slice(0, 8)}`;
    const identity = { image: "https://example.test/kept.png", name: "Stored name", username };
    await prisma.user.update({ data: identity, where: { id: user.id } });

    const response = await updateIdentity({
      basePath,
      body: { ...identity, username: ` ${username.toUpperCase()} ` },
      headers,
      instance,
    });

    expect(response.status).toBe(200);

    await expect(prisma.user.findUniqueOrThrow({ where: { id: user.id } })).resolves.toMatchObject({
      ...identity,
      learnerRevision: 1n,
    });
  });

  it.each(["name", "username", "image"] as const)(
    "marks each successful redundant %s provider write",
    async (field) => {
      const { headers, user } = await signIn();

      const identity = {
        image: "https://example.test/unchanged.png",
        name: "Before",
        username: `same_${randomUUID().slice(0, 8)}`,
      };

      await prisma.user.update({ data: identity, where: { id: user.id } });
      const body = { [field]: identity[field] };

      const first = await updateIdentity({ basePath, body, headers, instance });
      expect(first.status).toBe(200);
      await expect(first.json()).resolves.toStrictEqual({ status: true });

      await expect(
        prisma.user.findUniqueOrThrow({ where: { id: user.id } }),
      ).resolves.toMatchObject({ ...identity, learnerRevision: 1n });

      const second = await updateIdentity({ basePath, body, headers, instance });
      expect(second.status).toBe(200);
      await expect(second.json()).resolves.toStrictEqual({ status: true });

      await expect(
        prisma.user.findUniqueOrThrow({ where: { id: user.id } }),
      ).resolves.toMatchObject({ ...identity, learnerRevision: 2n });
    },
  );

  it("does not mark an endpoint refusal or a username rejected by the provider", async () => {
    const logError = vi.spyOn(logger, "logError");
    const [{ headers, user }, other] = await Promise.all([signIn(), signIn()]);
    const username = `taken_${randomUUID().slice(0, 8)}`;
    await prisma.user.update({ data: { username }, where: { id: other.user.id } });

    const [refusedField, refusedUsername] = await Promise.all([
      updateIdentity({
        basePath,
        body: { email: "refused@example.test", name: "Refused" },
        headers,
        instance,
      }),
      updateIdentity({ basePath, body: { name: "Refused", username }, headers, instance }),
    ]);

    expect(refusedField.status).toBe(400);
    expect(refusedUsername.status).toBe(400);

    await expect(prisma.user.findUniqueOrThrow({ where: { id: user.id } })).resolves.toMatchObject({
      learnerRevision: 0n,
      name: "Before",
      username: null,
    });

    expect(logError).not.toHaveBeenCalled();
  });

  it("refuses an unauthenticated write", async () => {
    const logError = vi.spyOn(logger, "logError");

    const response = await updateIdentity({
      basePath,
      body: { name: "Refused" },
      headers: new Headers(),
      instance,
    });

    expect(response.status).toBe(401);
    expect(logError).not.toHaveBeenCalled();
  });

  it("logs real marker overflow while preserving the successful identity response and cookies", async () => {
    const logError = vi.spyOn(logger, "logError");
    const { headers, user } = await signIn();
    const maximumRevision = 9_223_372_036_854_775_807n;

    await prisma.user.update({
      data: { learnerRevision: maximumRevision },
      where: { id: user.id },
    });

    const response = await updateIdentity({ basePath, body: { name: "Saved" }, headers, instance });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toStrictEqual({ status: true });
    expect(response.headers.getSetCookie().length).toBeGreaterThan(0);

    await expect(prisma.user.findUniqueOrThrow({ where: { id: user.id } })).resolves.toMatchObject({
      learnerRevision: maximumRevision,
      name: "Saved",
    });

    expect(logError).toHaveBeenCalledExactlyOnceWith(
      "[learnerIdentity] The identity update succeeded but its learner revision could not be marked",
      expect.objectContaining({ code: "P2010", message: expect.stringContaining("22003") }),
    );
  });
});

/** A lifecycle barrier, not a mocked adapter: both requests still perform real provider UPDATEs. */
describe("concurrent learner identity transitions", () => {
  it("advances the revision when a paused old-name request replaces an observed newer name", async () => {
    const reached = Promise.withResolvers<string | undefined>();
    const resume = Promise.withResolvers<true>();

    const barrier = {
      hooks: {
        before: [
          {
            handler: createAuthMiddleware(async (context) => {
              reached.resolve(context.context.session?.user.name);
              await resume.promise;
            }),
            matcher: (context) =>
              context.path === "/update-user" &&
              context.headers?.get("x-test-paused-identity") === "true",
          },
        ],
      },
      id: "identity-transition-test-barrier",
    } satisfies BetterAuthPlugin;

    const instance = createIdentityAuth({ plugins: [barrier] });
    const { headers, user } = await signIn();
    const pausedHeaders = new Headers(headers);
    pausedHeaders.set("x-test-paused-identity", "true");

    const laterWrite = updateIdentity({
      basePath: "/api/auth",
      body: { name: "Before" },
      headers: pausedHeaders,
      instance,
    });

    try {
      const pausedIdentity = await reached.promise;
      expect(pausedIdentity).toBe("Before");

      const firstWrite = await updateIdentity({
        basePath: "/api/auth",
        body: { name: "New" },
        headers,
        instance,
      });

      expect(firstWrite.status).toBe(200);
      await expect(firstWrite.json()).resolves.toStrictEqual({ status: true });
      const observed = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(observed).toMatchObject({ learnerRevision: 1n, name: "New" });
    } finally {
      resume.resolve(true);
      await laterWrite;
    }

    const response = await laterWrite;
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toStrictEqual({ status: true });

    await expect(prisma.user.findUniqueOrThrow({ where: { id: user.id } })).resolves.toMatchObject({
      learnerRevision: 2n,
      name: "Before",
    });
  });
});
