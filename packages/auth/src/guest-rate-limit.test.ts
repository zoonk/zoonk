import { randomInt } from "node:crypto";
import { prisma } from "@zoonk/db";
import { describe, expect, it } from "vitest";
import { auth } from "./auth";
import { BETTER_AUTH_BASE_PATH } from "./config";

describe("Production guest rate limit", () => {
  it("production keeps other auth limits and ignores the E2E guest bypass header", async () => {
    const ip = `198.19.${randomInt(256)}.${randomInt(1, 255)}`;
    const guestPath = "/sign-in/anonymous";
    const otherPaths = ["/sign-in/email-otp", "/email-otp/send-verification-otp"];
    const guestIds = new Set<string>();
    const keys = [guestPath, ...otherPaths].map((path) => `${ip}|${path}`);

    await prisma.rateLimit.createMany({
      data: [
        { count: 59, key: `${ip}|${guestPath}`, lastRequest: BigInt(Date.now()) },
        ...otherPaths.map((path) => ({
          count: 3,
          key: `${ip}|${path}`,
          lastRequest: BigInt(Date.now()),
        })),
      ],
    });

    function post(path: string) {
      return auth.handler(
        new Request(`http://localhost:3000${BETTER_AUTH_BASE_PATH}${path}`, {
          body: JSON.stringify({}),
          headers: {
            "content-type": "application/json",
            origin: "http://localhost:3000",
            "x-e2e-auth-rate-limit": "false",
            "x-forwarded-for": ip,
          },
          method: "POST",
        }),
      );
    }

    try {
      const allowed = await post(guestPath);

      if (allowed.ok) {
        const body = await allowed.json();
        guestIds.add(body.user.id);
      }

      expect(allowed.status).toBe(200);
      const blocked = await post(guestPath);
      expect(blocked.status).toBe(429);

      const otherResponses = await Promise.all(otherPaths.map((path) => post(path)));
      expect(otherResponses.map((response) => response.status)).toStrictEqual([429, 429]);
    } finally {
      await prisma.user.deleteMany({ where: { id: { in: [...guestIds] } } });
      await prisma.rateLimit.deleteMany({ where: { key: { in: keys } } });
    }
  });
});
