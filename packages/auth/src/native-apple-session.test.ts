import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { getNumber } from "@zoonk/utils/json";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NativeAuthResponseError } from "./errors";
import { enforceNativeAppleSignInRateLimit } from "./native-apple-session";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_APP_DOMAIN = "localhost:4000";
  process.env.NEXT_PUBLIC_AUTH_BASE_PATH = "/v1/auth";
});

function createRequestIP() {
  const id = randomUUID().replaceAll("-", "");
  return `11.${Number.parseInt(id.slice(0, 2), 16)}.${Number.parseInt(id.slice(2, 4), 16)}.${Number.parseInt(id.slice(4, 6), 16)}`;
}

function createSignInInput() {
  const ip = createRequestIP();

  return {
    input: {
      headers: new Headers({ "x-forwarded-for": ip }),
      requestURL: "http://localhost:4000/v1/sessions/apple",
    },
    rateLimitKey: `${ip}|/sign-in/native-apple`,
  };
}

async function getRateLimitStatus(input: { headers: Headers; requestURL: string }) {
  return enforceNativeAppleSignInRateLimit(input).then(
    () => null,
    (error: unknown) => getNumber(error, "statusCode"),
  );
}

describe(enforceNativeAppleSignInRateLimit, () => {
  const rateLimitKeys = new Set<string>();

  afterEach(async () => {
    await prisma.rateLimit.deleteMany({ where: { key: { in: [...rateLimitKeys] } } });
    rateLimitKeys.clear();
  });

  it("enforces Better Auth's sign-in rate limit through its HTTP boundary", async () => {
    const { input, rateLimitKey } = createSignInInput();
    rateLimitKeys.add(rateLimitKey);

    await enforceNativeAppleSignInRateLimit(input);
    await enforceNativeAppleSignInRateLimit(input);
    await enforceNativeAppleSignInRateLimit(input);

    const rateLimitError = enforceNativeAppleSignInRateLimit(input);

    await expect(rateLimitError).rejects.toBeInstanceOf(NativeAuthResponseError);

    await expect(rateLimitError).rejects.toMatchObject({
      retryAfter: expect.any(Number),
      statusCode: 429,
    });
  });

  it("atomically limits concurrent sign-in attempts", async () => {
    const { input, rateLimitKey } = createSignInInput();
    rateLimitKeys.add(rateLimitKey);

    const statuses = await Promise.all(Array.from({ length: 4 }, () => getRateLimitStatus(input)));

    expect(statuses.filter((status) => status === 429)).toHaveLength(1);
  });
});
