import { request } from "@playwright/test";
import { expect, test } from "@zoonk/e2e/fixtures";
import { createBearerLearner } from "./helpers/bearer";

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

  test("starts empty and saves the buddy and settings", async () => {
    const { api } = await createBearerLearner({ baseURL, prefix: "profile" });

    const initial = await api.get("/v1/me/learning-profile");
    expect(initial.status()).toBe(200);

    await expect(initial.json()).resolves.toStrictEqual({
      profile: {
        activeGoalId: null,
        availableGlasses: ["round"],
        buddy: null,
        dailyLimitMinutes: null,
        soundsEnabled: true,
      },
    });

    const updated = await api.patch("/v1/me/learning-profile", {
      data: { buddy: { kind: "beep", name: "Bip" }, soundsEnabled: false },
    });

    expect(updated.status()).toBe(200);

    await expect(updated.json()).resolves.toMatchObject({
      profile: { buddy: { glasses: "round", kind: "beep", name: "Bip" }, soundsEnabled: false },
    });

    const limited = await api.patch("/v1/me/learning-profile", { data: { dailyLimitMinutes: 40 } });
    await expect(limited.json()).resolves.toMatchObject({ profile: { dailyLimitMinutes: 40 } });

    const timeLimit = await api.get("/v1/me/daily-time-limit");
    await expect(timeLimit.json()).resolves.toMatchObject({ limitMinutes: 40, reached: false });

    await api.dispose();
  });

  test("validates the update and refuses glasses that weren't earned", async () => {
    const { api } = await createBearerLearner({ baseURL, prefix: "profile-invalid" });

    const [empty, unknown, glasses] = await Promise.all([
      api.patch("/v1/me/learning-profile", { data: {} }),
      api.patch("/v1/me/learning-profile", { data: { birth: { month: 3, year: 1990 } } }),
      api.patch("/v1/me/learning-profile", { data: { buddy: { glasses: "monocle", kind: "zu" } } }),
    ]);

    expect(empty.status()).toBe(400);
    expect(unknown.status()).toBe(400);
    expect(glasses.status()).toBe(422);
    await expect(glasses.json()).resolves.toMatchObject({ error: { code: "GLASSES_NOT_EARNED" } });

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
