import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { betterAuth } from "better-auth/minimal";
import { bearer } from "better-auth/plugins";
import { describe, expect, it } from "vitest";
import { baseAuthConfig } from "./server";

const auth = betterAuth({
  ...baseAuthConfig,
  baseURL: "http://localhost:3000",
  emailAndPassword: { enabled: true },
  plugins: [bearer()],
  rateLimit: { enabled: false },
  secret: "access-record-test-secret-with-enough-entropy",
});

describe("access records", () => {
  it.each(["203.0.113.10", "2804:014c:1234:5678:abcd:ef01:2345:6789"])(
    "records the full IP %s and keeps it after sign-out and account deletion",
    async (ipAddress) => {
      const result = await auth.api.signUpEmail({
        body: {
          email: `${randomUUID()}@example.test`,
          name: "Access",
          password: "test-password-12345",
        },
        headers: new Headers({ "x-forwarded-for": ipAddress }),
      });

      const session = await prisma.session.findUniqueOrThrow({ where: { token: result.token! } });
      const records = await prisma.accessRecord.findMany({ where: { userId: result.user.id } });

      expect(records).toStrictEqual([
        { createdAt: session.createdAt, id: session.id, ipAddress, userId: result.user.id },
      ]);

      await auth.api.signOut({ headers: new Headers({ authorization: `Bearer ${result.token}` }) });
      await expect(prisma.session.findUnique({ where: { id: session.id } })).resolves.toBeNull();
      await prisma.user.delete({ where: { id: result.user.id } });

      await expect(
        prisma.accessRecord.findMany({ where: { userId: result.user.id } }),
      ).resolves.toStrictEqual(records);
    },
  );
});
