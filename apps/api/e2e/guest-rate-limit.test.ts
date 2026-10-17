import { randomInt } from "node:crypto";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";

/** Each test owns one IP bucket, including repeated runs on the same lane database. */
function createGuestHeaders(baseURL: string | undefined) {
  if (!baseURL) {
    throw new Error("The E2E server must provide a base URL.");
  }

  return {
    origin: baseURL,
    "x-e2e-auth-rate-limit": "true",
    "x-forwarded-for": `198.18.${randomInt(256)}.${randomInt(1, 255)}`,
  };
}

test("a classroom can create 40 distinct guest sessions from one IP", async ({
  baseURL,
  request,
}) => {
  const headers = createGuestHeaders(baseURL);
  const guestIds = new Set<string>();

  try {
    for (const index of Array.from({ length: 40 }, (_, value) => value)) {
      // eslint-disable-next-line no-await-in-loop -- Sequential requests reproduce one NAT's burst without racing cookies.
      const response = await request.post("/v1/auth/sign-in/anonymous", {
        data: {},
        headers: { ...headers, cookie: "" },
      });

      expect(response.status(), `Guest ${index + 1}`).toBe(200);
      // eslint-disable-next-line no-await-in-loop -- Inspect each real session before sending the next guest request.
      const body = await response.json();
      expect(body.user.isAnonymous).toBe(true);
      expect(body.token).toEqual(expect.any(String));
      expect(response.headers()["set-cookie"]).toContain("session_token");
      guestIds.add(body.user.id);
    }

    expect(guestIds.size).toBe(40);
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: [...guestIds] } } });

    await prisma.rateLimit.deleteMany({
      where: { key: `${headers["x-forwarded-for"]}|/sign-in/anonymous` },
    });
  }
});

test("the 61st guest attempt is blocked without creating an account", async ({
  baseURL,
  request,
}) => {
  const headers = createGuestHeaders(baseURL);
  const key = `${headers["x-forwarded-for"]}|/sign-in/anonymous`;

  /** Seed only the counter to exercise the real boundary without creating 60 extra accounts. */
  await prisma.rateLimit.create({ data: { count: 59, key, lastRequest: BigInt(Date.now()) } });

  try {
    const allowed = await request.post("/v1/auth/sign-in/anonymous", {
      data: {},
      headers: { ...headers, cookie: "" },
    });

    expect(allowed.status()).toBe(200);
    const body = await allowed.json();

    try {
      const blocked = await request.post("/v1/auth/sign-in/anonymous", {
        data: {},
        headers: { ...headers, cookie: "" },
      });

      expect(blocked.status()).toBe(429);
      expect(Number(blocked.headers()["x-retry-after"])).toBeGreaterThan(0);
      expect(Number(blocked.headers()["x-retry-after"])).toBeLessThanOrEqual(60);
      expect(blocked.headers()["set-cookie"]).toBeUndefined();

      expect(await blocked.json()).toEqual({
        message: "Too many requests. Please try again later.",
      });

      expect(await prisma.session.count({ where: { ipAddress: headers["x-forwarded-for"] } })).toBe(
        1,
      );

      expect(await prisma.rateLimit.findUnique({ where: { key } })).toMatchObject({ count: 60 });
    } finally {
      await prisma.user.delete({ where: { id: body.user.id } });
    }
  } finally {
    await prisma.rateLimit.deleteMany({ where: { key } });
  }
});

test("ordinary E2E auth requests bypass exhausted counters on every fixture path", async ({
  baseURL,
  request,
}) => {
  const guestHeaders = createGuestHeaders(baseURL);

  const headers = {
    cookie: "",
    origin: guestHeaders.origin,
    "x-forwarded-for": guestHeaders["x-forwarded-for"],
  };

  const paths = [
    "/sign-up/email",
    "/sign-in/email",
    "/email-otp/send-verification-otp",
    "/sign-in/email-otp",
    "/one-time-token/generate",
    "/one-time-token/verify",
    "/sign-in/anonymous",
  ];

  const keys = paths.map((path) => `${headers["x-forwarded-for"]}|${path}`);
  const guestIds = new Set<string>();

  await prisma.rateLimit.createMany({
    data: keys.map((key) => ({ count: 1000, key, lastRequest: BigInt(Date.now()) })),
  });

  try {
    for (const path of paths) {
      // eslint-disable-next-line no-await-in-loop -- Each endpoint must bypass its own exhausted counter before validation.
      const response = await request.fetch(`/v1/auth${path}`, {
        ...(path !== "/one-time-token/generate" && { data: {} }),
        headers,
        method: path === "/one-time-token/generate" ? "GET" : "POST",
      });

      if (path === "/sign-in/anonymous" && response.ok()) {
        // eslint-disable-next-line no-await-in-loop -- Record the guest for cleanup even if a subsequent assertion fails.
        const body = await response.json();
        guestIds.add(body.user.id);
      }

      /** Empty bodies exercise validation without sending OTPs or creating signed-in users. */
      const expectedStatus =
        { "/one-time-token/generate": 401, "/sign-in/anonymous": 200 }[path] ?? 400;

      expect(response.status(), path).toBe(expectedStatus);
    }
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: [...guestIds] } } });
    await prisma.rateLimit.deleteMany({ where: { key: { in: keys } } });
  }
});
