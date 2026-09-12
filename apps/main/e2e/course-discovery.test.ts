import { prisma } from "@zoonk/db";
import { expect, test } from "./fixtures";
import {
  DISCOVERY_QUESTION,
  PRIVATE_BRIEF,
  exhaustDiscoveryAllowance,
  privateLearningCourse,
} from "./private-learning-fixtures";

test("resumes a prepared private discovery after reload and keeps its course out of guest pages", async ({
  noProgressUser,
  page: guest,
  userWithoutProgress: page,
}) => {
  const scenario = await privateLearningCourse(noProgressUser.id);

  const discovery = await prisma.courseDiscovery.create({
    data: {
      answers: [{ answer: "A family archive", question: "Which project?", questionId: "project" }],
      brief: PRIVATE_BRIEF,
      courseId: scenario.course.id,
      language: "en",
      prompt: "Help me organize my family's photographs",
      status: "completed",
      userId: noProgressUser.id,
    },
  });

  await page.goto(`/start/discovery/${discovery.id}`);
  await page.getByText("Your answers", { exact: true }).click();
  await expect(page.getByText("A family archive", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: PRIVATE_BRIEF.title })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/u);
  await page.getByRole("button", { exact: true, name: "Continue learning" }).click();
  await expect(page).toHaveURL(scenario.lessonHref);
  await expect(page.getByText("A shared memory", { exact: true })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/u);

  await guest.goto(scenario.href);
  await expect(guest.getByRole("heading", { name: PRIVATE_BRIEF.title })).toHaveCount(0);
  await expect(guest.getByText("A shared memory", { exact: true })).toHaveCount(0);
  const response = await guest.request.get(`/start/discovery/${discovery.id}`, { maxRedirects: 0 });
  expect(await response.text()).not.toContain("A family archive");

  expect(
    await prisma.generationQuotaClaim.count({ where: { actorKey: `user:${noProgressUser.id}` } }),
  ).toBe(0);
});

test("saves a corrected discovery answer and discards dependent answers even when the next AI request is limited", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  await exhaustDiscoveryAllowance(noProgressUser.id);

  const discovery = await prisma.courseDiscovery.create({
    data: {
      answers: [
        { answer: "A family album", question: "Which project?", questionId: "project" },
        { answer: "A printed book", question: "How will you share it?", questionId: "sharing" },
      ],
      brief: PRIVATE_BRIEF,
      language: "en",
      prompt: "My family project",
      status: "ready",
      userId: noProgressUser.id,
    },
  });

  await page.goto(`/start/discovery/${discovery.id}`);
  await page.getByText("Review or change your answers", { exact: true }).click();
  await page.getByRole("button", { exact: true, name: "Change answer: Which project?" }).click();

  await page
    .getByRole("textbox", { name: "Your updated answer" })
    .fill("Record my grandmother's stories");

  await page.getByRole("button", { exact: true, name: "Update answer" }).click();

  await expect
    .poll(async () => prisma.courseDiscovery.findUniqueOrThrow({ where: { id: discovery.id } }))
    .toMatchObject({
      answers: [
        {
          answer: "Record my grandmother's stories",
          question: "Which project?",
          questionId: "project",
        },
      ],
      revision: 2,
      status: "failed",
    });

  await expect(page.getByRole("heading", { name: "Let's try that again" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("many requests today");
  await expect(page.getByText("Record my grandmother's stories", { exact: true })).toBeVisible();
  await expect(page.getByText("A printed book", { exact: true })).toHaveCount(0);
});

test("does not submit a stale discovery answer over a newer question", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const discovery = await prisma.courseDiscovery.create({
    data: {
      language: "en",
      nextQuestion: DISCOVERY_QUESTION,
      prompt: "A private family project",
      status: "ask",
      userId: noProgressUser.id,
    },
  });

  await page.goto(`/start/discovery/${discovery.id}`);
  await page.getByRole("radio", { exact: true, name: "Something else" }).check();

  await page
    .getByRole("textbox", { name: "Tell us what you have in mind" })
    .fill("My original idea");

  await prisma.courseDiscovery.update({
    data: {
      nextQuestion: {
        ...DISCOVERY_QUESTION,
        id: "audience",
        question: "Who will use the archive?",
      },
      revision: 2,
    },
    where: { id: discovery.id },
  });

  await page.getByRole("button", { exact: true, name: "Continue" }).click();

  await expect(
    page.getByText(
      "Your learning request changed in another tab. We’ve loaded the latest version.",
      { exact: true },
    ),
  ).toBeVisible();

  expect(
    await prisma.courseDiscovery.findUniqueOrThrow({ where: { id: discovery.id } }),
  ).toMatchObject({ answers: [], revision: 2 });

  await page.reload();
  await expect(page.getByRole("group", { name: "Who will use the archive?" })).toBeVisible();
});

test("continues polling when another tab has already saved an answer and is preparing the next step", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const discovery = await prisma.courseDiscovery.create({
    data: {
      language: "en",
      nextQuestion: DISCOVERY_QUESTION,
      prompt: "A family archive",
      status: "ask",
      userId: noProgressUser.id,
    },
  });

  await page.goto(`/start/discovery/${discovery.id}`);
  await page.getByRole("radio", { exact: false, name: "A photo album" }).check();

  await prisma.courseDiscovery.update({
    data: { revision: 2, status: "pending" },
    where: { id: discovery.id },
  });

  await page.getByRole("button", { exact: true, name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Shaping your learning plan" })).toBeFocused();

  await prisma.courseDiscovery.update({
    data: { brief: PRIVATE_BRIEF, status: "ready" },
    where: { id: discovery.id },
  });

  await expect(page.getByRole("heading", { name: PRIVATE_BRIEF.title })).toBeFocused({
    timeout: 10_000,
  });

  await expect(page.getByRole("button", { exact: true, name: "Start learning" })).toBeVisible();
});
