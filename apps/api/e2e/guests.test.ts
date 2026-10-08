import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { createGuest } from "./helpers/bearer";

test.describe("Guests API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test("creates a guest who can use the product within the guest allowance", async () => {
    const { guestApi } = await createGuest(baseURL);

    const [allowance, profile, invite, again] = await Promise.all([
      guestApi.get("/v1/me/allowance"),
      guestApi.get("/v1/me/learning-profile"),
      guestApi.post("/v1/me/guardian-links", { data: { email: "parent@zoonk.test" } }),
      guestApi.post("/v1/guests"),
    ]);

    await expect(allowance.json()).resolves.toMatchObject({
      generatedLessons: { limit: 1, used: 0 },
      tier: "guest",
    });

    expect(profile.status()).toBe(200);
    expect(invite.status()).toBe(403);
    await expect(invite.json()).resolves.toMatchObject({ error: { code: "ACCOUNT_REQUIRED" } });
    expect(again.status()).toBe(409);

    await guestApi.dispose();
  });

  test("moves the guest's profile to the account they sign up with", async () => {
    const { guestApi, token } = await createGuest(baseURL);

    await guestApi.patch("/v1/me/learning-profile", {
      data: { buddy: { kind: "otto", name: "Octo" } },
    });

    const guest = await prisma.userLearningProfile.findFirstOrThrow({
      where: { buddyKind: "otto", user: { isAnonymous: true, sessions: { some: { token } } } },
    });

    const email = `e2e-guest-${randomUUID().slice(0, 8)}@zoonk.test`;

    const signUp = await guestApi.post("/v1/auth/sign-up/email", {
      data: { email, name: "E2E Guest", password: "password123" },
      headers: { Origin: new URL(baseURL).origin },
    });

    expect(signUp.ok()).toBe(true);

    await expect(
      prisma.userLearningProfile.findFirst({ where: { user: { email } } }),
    ).resolves.toMatchObject({ buddyKind: "otto", buddyName: "Octo" });

    await expect(prisma.user.findUnique({ where: { id: guest.userId } })).resolves.toBeNull();

    await guestApi.dispose();
  });
});
