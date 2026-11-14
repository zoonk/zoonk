import { randomUUID } from "node:crypto";
import { PROFILE_QUESTIONS } from "@zoonk/core/profile/questions/contract";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { type Page, expect, test } from "./fixtures";
import { followRun } from "./generation-run";

const CITATION = { passage: "passage", sourceId: "notice" };
const SUBJECTS = ["Portuguese", "Administrative law", "Statistics"];
const QUESTIONS_PER_SUBJECT = 2;
const DAYS_TO_EXAM = 60;
const MS_PER_DAY = 86_400_000;
const SHORT_DAILY_MINUTES = 5;
const LESSONS_PAST_THE_TIME = 60;

const AT_THE_TEST = [...PROFILE_QUESTIONS, "target", "targetDate", "level", "buddy"];

/**
 * `seen`: past its setup, on a plan the learner has seen whose time doesn't cover everything, so
 * the test proposes its focus instead of setting it. `writingRunId`: its questions are still being
 * written by that run, so the test waits for them.
 */
async function createExamGoalAtFocusTest(
  userId: string,
  { seen = false, writingRunId = null }: { seen?: boolean; writingRunId?: string | null } = {},
) {
  const suffix = randomUUID().slice(0, 6);

  const blueprint = await examBlueprintFixture({
    name: `Analyst exam ${suffix}`,
    structure: {
      formats: [
        { citation: CITATION, description: "Two options", kind: "multipleChoice", options: 2 },
      ],
      mock: null,
      rules: [],
      subjects: SUBJECTS.map((name, index) => ({
        citation: CITATION,
        name,
        questions: (SUBJECTS.length - index) * 10,
        topics: [`${name} basics`],
        weight: null,
      })),
    },
  });

  const [goal, skills] = await Promise.all([
    goalFixture({
      details: {
        answered: seen ? [...AT_THE_TEST, "placement", "schedule"] : AT_THE_TEST,
        examName: blueprint.name,
      },
      examBlueprintId: blueprint.id,
      generationRunId: writingRunId,
      kind: "exam",
      planRevealedAt: seen ? new Date() : null,
      targetDate: new Date(Date.now() + DAYS_TO_EXAM * MS_PER_DAY),
      timezone: "UTC",
      ...(seen && { dailyMinutes: SHORT_DAILY_MINUTES }),
      title: blueprint.name,
      userId,
    }),
    Promise.all(SUBJECTS.map((name) => skillFixture({ name: `${name} basics ${suffix}` }))),
  ]);

  const plan = await planFixture({
    coveredShare: seen ? 0.5 : null,
    goalId: goal.id,
    graph: {
      phases: [{ milestone: null, name: "Foundations" }],
      skills: skills.map((skill, index) => ({
        area: SUBJECTS[index] ?? "",
        lessons: seen ? LESSONS_PAST_THE_TIME : 2,
        name: skill.name,
        phase: 0,
        skillId: skill.id,
        weight: null,
      })),
    },
    placementPreparedAt: writingRunId ? null : new Date(),
  });

  await Promise.all([
    ...skills.map((skill, position) =>
      planItemFixture({ phase: 0, planId: plan.id, position, skillId: skill.id }),
    ),
    ...skills.flatMap((skill) =>
      Array.from({ length: writingRunId ? 0 : QUESTIONS_PER_SUBJECT }, () =>
        itemFixture({
          content: choiceItemContent(),
          examBlueprintId: blueprint.id,
          skillId: skill.id,
        }),
      ),
    ),
  ]);

  return goal;
}

async function readProposalStatus(goalId: string) {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId } });
  const change = await prisma.planChange.findFirstOrThrow({ where: { planId: plan.id } });
  return change.status;
}

async function dropFirstAnswerResponse(page: Page) {
  let dropped = false;

  await page.route("**/*", async (route) => {
    const request = route.request();
    const isAction = request.method() === "POST" && request.headers()["next-action"];
    const isAnswer = (request.postData() ?? "").includes('"itemId"');

    if (!dropped && isAction && isAnswer) {
      dropped = true;
      await route.fetch();
      await route.abort();
      return;
    }

    await route.fallback();
  });
}

/** The completion never reaches the server, while every placement read still does. Returns what lifts it. */
async function rejectCompletion(page: Page) {
  const anyRequest = "**/*";

  await page.route(anyRequest, async (route) => {
    const request = route.request();
    const isAction = request.method() === "POST" && request.headers()["next-action"];
    const isCompletion = (request.postData() ?? "").includes('"fromScratch"');

    if (isAction && isCompletion) {
      await route.abort();
      return;
    }

    await route.fallback();
  });

  return () => page.unroute(anyRequest);
}

function question(page: Page, number: number) {
  return page.getByText(new RegExp(`^Question ${number} of \\d+$`, "u"));
}

async function loadSaved({ goalId, userId }: { goalId: string; userId: string }) {
  const [attempts, goal] = await Promise.all([
    prisma.attempt.findMany({ select: { itemId: true }, where: { userId } }),
    prisma.goal.findUniqueOrThrow({ select: { details: true }, where: { id: goalId } }),
  ]);

  return { attempts, details: goal.details };
}

test.describe("An exam's Focus test in onboarding", () => {
  test("counts an answer once on a bad connection, picks up after a reload and leads to the daily time", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const goal = await createExamGoalAtFocusTest(noProgressUser.id);
    await dropFirstAnswerResponse(page);

    await page.goto(`/start/${goal.id}`);
    await page.getByRole("button", { exact: true, name: "Start" }).click();
    await expect(question(page, 1)).toBeVisible();

    const dontKnow = page.getByRole("button", { name: "I don't know yet" });
    await dontKnow.click();
    await expect(page.getByRole("alert").filter({ hasText: "didn't go through" })).toBeVisible();

    await dontKnow.click();
    await expect(question(page, 2)).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: "Continue your test" })).toBeVisible();
    await expect(page.getByText("Your 1 answer is saved.")).toBeVisible();
    await page.getByRole("button", { exact: true, name: "Continue" }).click();
    await expect(question(page, 2)).toBeVisible();

    await page.getByRole("radio", { name: "Right answer" }).click();
    await page.getByRole("button", { exact: true, name: "Confirm" }).click();
    await expect(question(page, 3)).toBeVisible();

    await page.getByRole("button", { name: "Stop and use my answers" }).click();
    await page.getByRole("button", { exact: true, name: "Continue" }).click();

    await expect(
      page.getByRole("heading", { name: "How much time can you study each day?" }),
    ).toBeVisible();

    const saved = await loadSaved({ goalId: goal.id, userId: noProgressUser.id });
    expect(saved.attempts).toHaveLength(2);
    expect(new Set(saved.attempts.map((attempt) => attempt.itemId)).size).toBe(2);
    expect(saved.details).toMatchObject({ answered: expect.arrayContaining(["placement"]) });
  });

  test("skipping it goes straight to the daily time and saves no answer", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const goal = await createExamGoalAtFocusTest(noProgressUser.id);

    await page.goto(`/start/${goal.id}`);
    await page.getByRole("button", { name: "Skip for now" }).click();

    await expect(
      page.getByRole("heading", { name: "How much time can you study each day?" }),
    ).toBeVisible();

    const saved = await loadSaved({ goalId: goal.id, userId: noProgressUser.id });
    expect(saved.attempts).toHaveLength(0);
    expect(saved.details).toMatchObject({ answered: expect.arrayContaining(["placement"]) });
  });
});

test("a focus proposed on a plan already seen applies on the learner's tap, and Undo takes it back", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const goal = await createExamGoalAtFocusTest(noProgressUser.id, { seen: true });

  await page.goto(`/focus-test?goal=${goal.id}`);
  await page.getByRole("button", { exact: true, name: "Start" }).click();
  await expect(question(page, 1)).toBeVisible();
  await page.getByRole("button", { name: "I don't know yet" }).click();
  await expect(question(page, 2)).toBeVisible();
  await page.getByRole("button", { name: "Stop and use my answers" }).click();

  const update = page.getByRole("button", { name: "Change my plan" });
  await expect(page.getByRole("heading", { name: "Give these subjects more time?" })).toBeVisible();

  await update.click();
  await expect(page.getByText("Your plan now gives these subjects more time.")).toBeVisible();
  expect(await readProposalStatus(goal.id)).toBe("applied");

  await page.getByRole("button", { name: "See all subjects" }).click();
  await expect(page.getByText("Not known yet")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("Undone. Your plan is back as it was.")).toBeVisible();
  expect(await readProposalStatus(goal.id)).toBe("undone");

  await page.reload();
  await expect(page.getByText("Your plan stays as it is.")).toBeVisible();
  await expect(update).toBeHidden();
});

test("a skip that doesn't save says so on the wait for questions, and the same button retries it", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const runId = `e2e-focus-test-${randomUUID()}`;
  const goal = await createExamGoalAtFocusTest(noProgressUser.id, { writingRunId: runId });

  await followRun({
    events: [
      { entityId: goal.id, status: "started", step: "preparePlacement" },
      { entityId: goal.id, reason: "aiGenerationFailed", status: "error", step: "workflowError" },
    ],
    page,
    runId,
  });

  const allowCompletion = await rejectCompletion(page);
  await page.goto(`/start/${goal.id}`);
  await page.getByRole("button", { exact: true, name: "Start" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "This didn't finish" })).toBeVisible();
  const skip = page.getByRole("button", { name: "Skip for now" });
  await skip.click();

  await expect(page.getByRole("alert").filter({ hasText: "That didn't save." })).toBeVisible();
  await expect(skip).toBeEnabled();

  await allowCompletion();
  await skip.click();

  await expect(
    page.getByRole("heading", { name: "How much time can you study each day?" }),
  ).toBeVisible();
});
