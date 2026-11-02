import { randomInt } from "node:crypto";
import { prisma } from "@zoonk/db";
import { describe, expect, it } from "vitest";
import { auth } from "./auth";
import { BETTER_AUTH_BASE_PATH } from "./config";

const SHARED_IP_PATHS = [
  "/sign-in/anonymous",
  "/email-otp/send-verification-otp",
  "/sign-in/email-otp",
];

describe("Production sign-in rate limits", () => {
  it("lets one IP start or sign in 60 times a minute and ignores the E2E bypass header", async () => {
    const ip = `198.19.${randomInt(256)}.${randomInt(1, 255)}`;
    const defaultPath = "/sign-in/social";
    const keys = [...SHARED_IP_PATHS, defaultPath].map((path) => `${ip}|${path}`);
    const guestIds = new Set<string>();

    await prisma.rateLimit.createMany({
      data: [
        ...SHARED_IP_PATHS.map((path) => ({
          count: 59,
          key: `${ip}|${path}`,
          lastRequest: BigInt(Date.now()),
        })),
        { count: 3, key: `${ip}|${defaultPath}`, lastRequest: BigInt(Date.now()) },
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
      const sixtieth = await Promise.all(SHARED_IP_PATHS.map((path) => post(path)));
      const [guest] = sixtieth;

      if (guest?.ok) {
        const body = await guest.json();
        guestIds.add(body.user.id);
      }

      expect(sixtieth.map((response) => response.status)).toStrictEqual([200, 400, 400]);

      const blocked = await Promise.all(
        [...SHARED_IP_PATHS, defaultPath].map((path) => post(path)),
      );

      expect(blocked.map((response) => response.status)).toStrictEqual([429, 429, 429, 429]);
    } finally {
      await prisma.user.deleteMany({ where: { id: { in: [...guestIds] } } });
      await prisma.rateLimit.deleteMany({ where: { key: { in: keys } } });
    }
  });
});
