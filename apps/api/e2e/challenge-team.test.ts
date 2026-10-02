import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { challengeTeamSchema } from "@zoonk/core/library/challenges/team";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { createBearerLearner } from "./helpers/bearer";

test.describe("GET /v1/library/lessons/{lessonId}/challenge-team", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test("picks the plan's team once and returns the same people every time", async () => {
    const [{ api, userId }, { lesson }] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "challenge-team" }),
      playableLessonFixture({ lesson: { language: "pt" }, steps: ["challenge"] }),
    ]);

    const goal = await goalFixture({ userId });
    const plan = await planFixture({ goalId: goal.id, settings: { focusAreas: ["Estatística"] } });
    await planItemFixture({ lessonId: lesson.id, planId: plan.id });

    const first = await api.get(`/v1/library/lessons/${lesson.id}/challenge-team`);
    expect(first.status()).toBe(200);

    const team = challengeTeamSchema.parse(await first.json());
    expect(team.language).toBe("pt");
    expect(team.members).toHaveLength(4);

    const again = await api.get(`/v1/library/lessons/${lesson.id}/challenge-team`);
    await expect(again.json()).resolves.toStrictEqual(team);

    const stored = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    expect(stored.settings).toMatchObject({ focusAreas: ["Estatística"], team });

    await api.dispose();
  });

  test("asks for a session and answers 404 for lessons that don't exist", async () => {
    const [{ lesson }, anonymous, { api }] = await Promise.all([
      playableLessonFixture({ steps: ["challenge"] }),
      request.newContext({ baseURL }),
      createBearerLearner({ baseURL, prefix: "challenge-team-missing" }),
    ]);

    const [unsigned, missing, invalid] = await Promise.all([
      anonymous.get(`/v1/library/lessons/${lesson.id}/challenge-team`),
      api.get(`/v1/library/lessons/${randomUUID()}/challenge-team`),
      api.get("/v1/library/lessons/not-a-uuid/challenge-team"),
    ]);

    expect([unsigned.status(), missing.status(), invalid.status()]).toStrictEqual([401, 404, 400]);

    await Promise.all([anonymous.dispose(), api.dispose()]);
  });
});
