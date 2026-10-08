import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { createBearerLearner } from "./helpers/bearer";

const THIS_YEAR = new Date().getUTCFullYear();

test.describe("Learning profile API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test("rejects requests without a session", async () => {
    const api = await request.newContext({ baseURL });

    const responses = await Promise.all([
      api.get("/v1/me/learning-profile"),
      api.get("/v1/me/allowance"),
      api.get("/v1/me/daily-time-limit"),
    ]);

    expect(responses.map((response) => response.status())).toStrictEqual([401, 401, 401]);
    await api.dispose();
  });

  test("starts empty and saves buddy and age with the protections they imply", async () => {
    const { api } = await createBearerLearner({ baseURL, prefix: "profile" });

    const initial = await api.get("/v1/me/learning-profile");
    expect(initial.status()).toBe(200);

    await expect(initial.json()).resolves.toMatchObject({
      profile: {
        ageGroup: "unknown",
        availableGlasses: ["round"],
        buddy: null,
        dailyLimitMinutes: null,
        soundsEnabled: true,
      },
      protections: { plusPurchase: "allowed", sessionReplayAllowed: false },
    });

    const updated = await api.patch("/v1/me/learning-profile", {
      data: {
        birth: { month: 3, year: 1990 },
        buddy: { kind: "beep", name: "Bip" },
        soundsEnabled: false,
      },
    });

    expect(updated.status()).toBe(200);

    await expect(updated.json()).resolves.toMatchObject({
      profile: {
        ageGroup: "adult",
        birth: { month: 3, year: 1990 },
        buddy: { glasses: "round", kind: "beep", name: "Bip" },
        soundsEnabled: false,
      },
      protections: { ageGroup: "adult", sessionReplayAllowed: true },
    });

    const limited = await api.patch("/v1/me/learning-profile", { data: { dailyLimitMinutes: 40 } });
    await expect(limited.json()).resolves.toMatchObject({ profile: { dailyLimitMinutes: 40 } });

    const timeLimit = await api.get("/v1/me/daily-time-limit");
    await expect(timeLimit.json()).resolves.toMatchObject({ limitMinutes: 40, reached: false });

    await api.dispose();
  });

  test("validates the update and refuses glasses that weren't earned", async () => {
    const { api } = await createBearerLearner({ baseURL, prefix: "profile-invalid" });

    const [empty, future, glasses] = await Promise.all([
      api.patch("/v1/me/learning-profile", { data: {} }),
      api.patch("/v1/me/learning-profile", { data: { birth: { month: 1, year: THIS_YEAR + 1 } } }),
      api.patch("/v1/me/learning-profile", { data: { buddy: { glasses: "monocle", kind: "zu" } } }),
    ]);

    expect(empty.status()).toBe(400);
    expect(future.status()).toBe(400);
    expect(glasses.status()).toBe(422);
    await expect(glasses.json()).resolves.toMatchObject({ error: { code: "GLASSES_NOT_EARNED" } });

    await api.dispose();
  });

  test("lets a learner correct their age toward younger and leaves older answers to support", async () => {
    const { api } = await createBearerLearner({ baseURL, prefix: "profile-birth" });
    const teenBirth = { month: 6, year: THIS_YEAR - 15 };

    const first = await api.patch("/v1/me/learning-profile", { data: { birth: teenBirth } });
    await expect(first.json()).resolves.toMatchObject({ profile: { ageGroup: "teen" } });

    const older = await api.patch("/v1/me/learning-profile", {
      data: { birth: { month: 6, year: 1990 } },
    });

    expect(older.status()).toBe(409);

    await expect(older.json()).resolves.toMatchObject({
      error: { code: "BIRTH_CHANGE_NEEDS_SUPPORT" },
    });

    const younger = await api.patch("/v1/me/learning-profile", {
      data: { birth: { month: 9, year: THIS_YEAR - 15 } },
    });

    expect(younger.status()).toBe(200);

    await expect(younger.json()).resolves.toMatchObject({
      profile: { ageGroup: "teen", birth: { month: 9, year: THIS_YEAR - 15 } },
    });

    await api.dispose();
  });

  test("deletes the account when the age answer is under 13", async () => {
    const { api, userId } = await createBearerLearner({ baseURL, prefix: "profile-child" });

    const response = await api.patch("/v1/me/learning-profile", {
      data: { birth: { month: 1, year: THIS_YEAR - 9 } },
    });

    expect(response.status()).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "UNDER_MINIMUM_AGE" } });
    await expect(prisma.user.findUnique({ where: { id: userId } })).resolves.toBeNull();

    await api.dispose();
  });

  test("shows a free learner's lesson allowance", async () => {
    const { api } = await createBearerLearner({ baseURL, prefix: "allowance" });

    const response = await api.get("/v1/me/allowance");
    expect(response.status()).toBe(200);

    const body = await response.json();

    expect(body).toMatchObject({ activeGoals: { limit: 1, used: 0 }, tier: "free" });

    expect(body.items).toContainEqual(
      expect.objectContaining({
        dailyLimit: 20,
        kind: "lessonStart",
        monthlyLimit: 40,
        remaining: 20,
      }),
    );

    await api.dispose();
  });
});
