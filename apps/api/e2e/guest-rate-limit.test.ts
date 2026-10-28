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

test("the 61st guest attempt is blocked without creating an account", async ({
  baseURL,
  request,
}) => {
  const headers = createGuestHeaders(baseURL);
  const key = `${headers["x-forwarded-for"]}|/sign-in/anonymous`;

  // Seeds the counter one short of the limit instead of creating 59 accounts.
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
