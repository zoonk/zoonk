import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { coursePromptFixture } from "@zoonk/testing/fixtures/course-prompts";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { type Page, expect, test } from "./fixtures";
import {
  getGenerationLimitResponse,
  getGenerationTriggerRequests,
  isGenerationEvents,
  isGenerationTrigger,
  routeGenerationApis,
} from "./generation-api";

function getLateTriggerResponse({
  outcome,
  runId,
}: {
  outcome: "success" | "failure" | "quota";
  runId: string;
}) {
  if (outcome === "quota") {
    return getGenerationLimitResponse({
      period: "day",
      resource: "course",
      viewer: "authenticated",
    });
  }

  if (outcome === "failure") {
    return { body: { error: "Generation service unavailable" }, status: 503 };
  }

  return { body: { id: runId, status: "pending" }, status: 202 };
}

async function expectWinningRun({
  outcome,
  page,
}: {
  outcome: "success" | "failure" | "quota";
  page: Page;
}) {
  const organization = await getAiOrganization();
  const triggerRunId = `trigger-${randomUUID()}`;
  const winningRunId = `winning-${randomUUID()}`;
  const winningStreamRequested = Promise.withResolvers<null>();
  const triggerDelivered = Promise.withResolvers<null>();

  const course = await courseFixture({
    format: "language",
    generationRunId: winningRunId,
    generationStatus: "running",
    isPublished: true,
    organizationId: organization.id,
    targetLanguage: "ja",
  });

  const prompt = await coursePromptFixture({ courseFormat: "language", targetLanguage: "ja" });
  const lateResponse = getLateTriggerResponse({ outcome, runId: triggerRunId });

  // Hold the external generation response until the real prompt read has
  // joined the persisted winner. The server action and session remain real.
  await routeGenerationApis({
    handler: async (route) => {
      if (isGenerationTrigger({ request: route.request(), targetType: "coursePrompt" })) {
        await prisma.coursePrompt.update({
          data: { courseId: course.id, generationRunId: winningRunId, generationStatus: "running" },
          where: { id: prompt.id },
        });

        await winningStreamRequested.promise;

        await route.fulfill({
          body: JSON.stringify(lateResponse.body),
          contentType: "application/json",
          status: lateResponse.status,
        });

        triggerDelivered.resolve(null);
        return;
      }

      const url = new URL(route.request().url());

      if (!isGenerationEvents(url.toString())) {
        await route.continue();
        return;
      }

      if (url.pathname.includes(winningRunId)) {
        winningStreamRequested.resolve(null);
        await triggerDelivered.promise;
      }

      await route.fulfill({
        body: `data: ${JSON.stringify({ status: "started", step: "getCoursePrompt" })}\n\n`,
        contentType: "text/event-stream",
        status: 200,
      });
    },
    page,
  });

  const nextOutcome = Promise.race([
    page
      .waitForRequest((request) => {
        const url = new URL(request.url());

        return (
          isGenerationEvents(url.toString()) &&
          url.pathname.includes(winningRunId) &&
          url.searchParams.get("_rc") === "1"
        );
      })
      .then(() => "winner"),
    page
      .waitForRequest((request) => request.url().includes(`/generations/${triggerRunId}/events`))
      .then(() => "stale trigger"),
    page
      .getByRole("button", { name: "Try again" })
      .waitFor({ state: "visible" })
      .then(() => "error"),
    page
      .getByRole("heading", { name: "Daily course limit reached" })
      .waitFor({ state: "visible" })
      .then(() => "quota"),
  ]);

  await page.goto(`/generate/course/${prompt.id}`);

  expect(await nextOutcome).toBe("winner");
  await expect(page.getByRole("progressbar", { name: "Progress" })).toBeVisible();

  await expect(
    getGenerationTriggerRequests({ page, targetType: "coursePrompt" }),
  ).resolves.toHaveLength(1);
}

test("keeps the joined workflow after a delayed trigger success", async ({
  userWithoutProgress,
}) => {
  await expectWinningRun({ outcome: "success", page: userWithoutProgress });
});

test("keeps the joined workflow after a delayed trigger failure", async ({
  userWithoutProgress,
}) => {
  await expectWinningRun({ outcome: "failure", page: userWithoutProgress });
});

test("keeps the joined workflow after a delayed trigger quota", async ({ userWithoutProgress }) => {
  await expectWinningRun({ outcome: "quota", page: userWithoutProgress });
});
