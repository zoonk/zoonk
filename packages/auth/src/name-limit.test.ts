import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { describe, expect, it } from "vitest";
import { NAME_MAX_LENGTH, NAME_TOO_LONG_ERROR_CODE } from "./name-rules";
import { auth } from "./testing";

const PASSWORD = "name-limit-password";

function createEmail() {
  return `name-limit-${randomUUID()}@zoonk.test`;
}

async function signUp() {
  const email = createEmail();

  const { headers } = await auth.api.signUpEmail({
    body: { email, name: "Ana", password: PASSWORD },
    returnHeaders: true,
  });

  const cookie = headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");

  return { email, headers: new Headers({ cookie }) };
}

describe("name limit", () => {
  it("refuses a sign-up whose name is past the limit", async () => {
    const email = createEmail();

    await expect(
      auth.api.signUpEmail({
        body: { email, name: "a".repeat(NAME_MAX_LENGTH + 1), password: PASSWORD },
      }),
    ).rejects.toMatchObject({ body: { code: NAME_TOO_LONG_ERROR_CODE }, statusCode: 400 });

    await expect(prisma.user.findUnique({ where: { email } })).resolves.toBeNull();
  });

  it("refuses a name sent to Better Auth's update endpoint as anything but text", async () => {
    const { email, headers } = await signUp();

    await expect(
      auth.api.updateUser({
        body: { name: { set: "a".repeat(NAME_MAX_LENGTH + 1) } } as never,
        headers,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    await expect(prisma.user.findUniqueOrThrow({ where: { email } })).resolves.toMatchObject({
      name: "Ana",
    });
  });
});
