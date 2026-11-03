import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { describe, expect, it } from "vitest";
import { NAME_MAX_LENGTH, NAME_TOO_LONG_ERROR_CODE } from "./name-rules";
import { auth } from "./testing";

describe("name limit", () => {
  it("refuses a sign-up whose name is past the limit", async () => {
    const email = `name-limit-${randomUUID()}@zoonk.test`;

    await expect(
      auth.api.signUpEmail({
        body: { email, name: "a".repeat(NAME_MAX_LENGTH + 1), password: "name-limit-password" },
      }),
    ).rejects.toMatchObject({ body: { code: NAME_TOO_LONG_ERROR_CODE }, statusCode: 400 });

    await expect(prisma.user.findUnique({ where: { email } })).resolves.toBeNull();
  });
});
