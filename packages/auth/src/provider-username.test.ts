import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { type GenericEndpointContext } from "better-auth";
import { describe, expect, it } from "vitest";
import { nameProviderAccount } from "./provider-username";

/** The user Better Auth is about to create, as the database hook receives it. */
function newUser({ email, name }: { email: string; name: string }) {
  const now = new Date();
  return { createdAt: now, email, emailVerified: true, id: randomUUID(), name, updatedAt: now };
}

/** The endpoint creating the account, as Better Auth passes it to the hook. */
function endpoint(path: string) {
  return { path } as GenericEndpointContext;
}

function uniquePrefix() {
  return `named${randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

describe(nameProviderAccount, () => {
  it("names an account Google or Apple created in the browser after its email", async () => {
    const prefix = uniquePrefix();
    const user = newUser({ email: `${prefix}@example.test`, name: "Ana Souza" });

    await expect(nameProviderAccount(user, endpoint("/callback/:id"))).resolves.toStrictEqual({
      data: { ...user, displayUsername: prefix, username: prefix },
    });
  });

  it("adds a few numbers when another account has the email's name", async () => {
    const prefix = uniquePrefix();

    await prisma.user.create({
      data: { email: `${prefix}@other.test`, name: "", username: prefix },
    });

    const user = newUser({ email: `${prefix}@example.test`, name: "Ana Souza" });

    const result = await nameProviderAccount(user, endpoint("/callback/:id"));

    expect(result).toMatchObject({ data: { username: expect.stringMatching(`^${prefix}_\\d+$`) } });
  });

  it.each(["/sign-in/social", "/sign-in/email-otp", "/sign-in/anonymous", "/sign-up/email"])(
    "leaves an account created through %s to its own setup",
    async (path) => {
      const user = newUser({ email: `${uniquePrefix()}@example.test`, name: "Ana Souza" });

      await expect(nameProviderAccount(user, endpoint(path))).resolves.toStrictEqual({
        data: user,
      });
    },
  );

  it("leaves an account the provider didn't name to the setup, which asks for both", async () => {
    const user = newUser({ email: `${uniquePrefix()}@example.test`, name: "  " });

    await expect(nameProviderAccount(user, endpoint("/callback/:id"))).resolves.toStrictEqual({
      data: user,
    });

    await expect(nameProviderAccount(user, null)).resolves.toStrictEqual({ data: user });
  });
});
