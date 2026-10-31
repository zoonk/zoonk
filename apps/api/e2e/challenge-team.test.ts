import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { expect, test } from "@zoonk/e2e/fixtures";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { createBearerLearner } from "./helpers/bearer";

test.describe("GET /v1/library/lessons/{lessonId}/challenge-team", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
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
