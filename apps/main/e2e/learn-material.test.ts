import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { goalUnderstandingFixture } from "@zoonk/testing/fixtures/goal-understandings";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { learnerSourceFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { type Page, expect, test } from "./fixtures";
import { setDeviceMode } from "./learn-personas";

/**
 * Studying your own material: the paperclip takes a file, pasted text or a link, then "What do you
 * want to do?" turns it into an exam plan, lessons built from it, or answers from its pages. The
 * uploads and questions APIs are external here (Blob storage and a model), so they answer as they
 * would; lessons built from the material cite their slide in the player.
 */

const PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

/** A learner's material as `POST /v1/uploads` returns it once stored. */
async function stubUpload(page: Page, source: { id: string; title: string }) {
  await page.route("**/v1/uploads", (route) =>
    route.fulfill({ json: { checkingVisibility: false, source }, status: 201 }),
  );
}

async function openPaperclip(page: Page) {
  await page.goto("/start");
  await page.getByRole("button", { name: "Study your own material" }).click();
}

async function confirmGoal(page: Page, prompt: string) {
  await expect(page.getByRole("heading", { name: "Here's what I understood:" })).toBeVisible();
  await page.getByRole("button", { name: "Looks right" }).click();
  await expect(page).toHaveURL(/\/start\/[0-9a-f-]{36}$/u);

  return prisma.goal.findFirstOrThrow({ where: { prompt } });
}

test.describe("Studying your own material", () => {
  test("class slides with no words become an exam plan that asks for the test's date", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const title = `Aula 5 - Glicolise ${randomUUID().slice(0, 6)}`;

    const slides = await sourceFixture({
      kind: "upload",
      mimeType: PPTX,
      ownerId: noProgressUser.id,
      title,
      visibility: "private",
    });

    await learnerSourceFixture({ sourceId: slides.id, userId: noProgressUser.id });
    await stubUpload(page, { id: slides.id, title });

    const prompt = `Prepare for an exam on my material: ${title}`;

    await goalUnderstandingFixture({
      goal: prompt,
      result: {
        followUps: [],
        goals: [
          { examName: "Biology test", kind: "exam", subject: "biology", title: "Biology test" },
        ],
        route: "goals",
      },
    });

    await openPaperclip(page);
    await page.getByRole("button", { name: "Paste text" }).click();
    await page.getByRole("textbox", { name: "Your text" }).fill("Glycolysis nets 2 ATP.");
    await page.getByRole("button", { name: "Add text" }).click();

    await expect(page.getByRole("list", { name: "Your material" }).getByText(title)).toBeVisible();
    await expect(page.getByRole("heading", { name: "What do you want to do?" })).toBeVisible();

    // Without a choice, an empty box can't start anything.
    await expect(page.getByRole("button", { name: "Start with your goal" })).toBeDisabled();
    await page.getByRole("radio", { name: /Prepare for an exam/u }).click();
    await page.getByRole("button", { name: "Start with your goal" }).click();

    const goal = await confirmGoal(page, prompt);

    expect(goal.details).toMatchObject({ materialIntent: "exam" });

    // No notice gives a class test's date, so it's asked right after the target.
    await expect(page.getByRole("heading", { name: "What are you aiming for?" })).toBeVisible();
    await page.getByRole("button", { name: "Skip" }).click();

    await expect(
      page.getByRole("heading", { name: "Is there a date you're aiming for?" }),
    ).toBeVisible();

    await expect
      .poll(async () => {
        const link = await prisma.learnerSource.findFirstOrThrow({
          where: { sourceId: slides.id, userId: noProgressUser.id },
        });

        return link.goalId;
      })
      .toBe(goal.id);
  });

  test("a pasted link to a public page becomes lessons that teach it, in Fun", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const title = `enem.inep.gov.br/edital-${randomUUID().slice(0, 6)}`;
    const notice = await sourceFixture({ kind: "upload", title, visibility: "public" });
    await learnerSourceFixture({ sourceId: notice.id, userId: noProgressUser.id });
    await stubUpload(page, { id: notice.id, title });
    await setDeviceMode(page.context(), "fun");

    const words = `help me understand this notice ${randomUUID().slice(0, 6)}`;

    await goalUnderstandingFixture({
      goal: words,
      result: {
        followUps: [],
        goals: [{ kind: "learn", subject: "the ENEM notice", title: "Understand the notice" }],
        route: "goals",
      },
    });

    await openPaperclip(page);
    await page.getByRole("button", { name: "Paste a link" }).click();
    await page.getByRole("textbox", { name: "Link" }).fill(`https://${title}`);
    await page.getByRole("button", { name: "Add link" }).click();

    await expect(page.getByRole("list", { name: "Your material" }).getByText(title)).toBeVisible();
    await page.getByRole("radio", { name: /Understand this material/u }).click();
    await page.getByRole("textbox", { name: "Your goal" }).fill(words);
    await page.getByRole("button", { name: "Start with your goal" }).click();

    const goal = await confirmGoal(page, words);

    // Lessons that teach the material skip "What do you want from it?".
    expect(goal.details).toMatchObject({ materialIntent: "understand", purpose: "other" });
    await expect(page.getByRole("heading", { name: "What do you want from it?" })).toBeHidden();
  });

  test("questions about the material are answered from its pages", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const title = "Aula 5 - Glicolise";
    const slides = await sourceFixture({ kind: "upload", mimeType: PPTX, title });
    await learnerSourceFixture({ sourceId: slides.id, userId: noProgressUser.id });
    await stubUpload(page, { id: slides.id, title });
    await setDeviceMode(page.context(), "focus");

    await page.route("**/v1/material-questions", (route) =>
      route.fulfill({
        json: {
          answer: "It makes 4 ATP but spends 2, so 2 are left for each glucose.",
          citations: [{ page: 6, title, unit: "slide" }],
          found: true,
        },
      }),
    );

    await openPaperclip(page);
    await page.getByRole("button", { name: "Paste text" }).click();
    await page.getByRole("textbox", { name: "Your text" }).fill("Glycolysis nets 2 ATP.");
    await page.getByRole("button", { name: "Add text" }).click();
    await page.getByRole("radio", { name: /Ask questions/u }).click();
    await page.getByRole("button", { name: "Start with your goal" }).click();

    await expect(page.getByRole("heading", { name: "Ask about your material" })).toBeVisible();

    const question = page.getByRole("textbox", { name: "Your question" });
    await question.fill("Why only 2 ATP?");
    await question.press("Enter");

    await expect(page.getByText("so 2 are left for each glucose")).toBeVisible();

    await expect(
      page.getByRole("list", { name: "Where this comes from" }).getByText(`${title}, slide 6`),
    ).toBeVisible();

    // Asking isn't a goal: nothing was created.
    await expect(prisma.goal.count({ where: { userId: noProgressUser.id } })).resolves.toBe(0);
  });

  test("a lesson built from the learner's slides cites its slide", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const slides = await sourceFixture({
      kind: "upload",
      mimeType: PPTX,
      ownerId: noProgressUser.id,
      title: "Aula 5 - Glicolise",
      visibility: "private",
    });

    const { lesson, steps } = await playableLessonFixture({
      lesson: { ownerId: noProgressUser.id, visibility: "private" },
      steps: ["explanation", "check"],
    });

    await prisma.step.update({
      data: { sourceId: slides.id, sourcePage: 3 },
      where: { id: steps[0]?.id },
    });

    await setDeviceMode(page.context(), "fun");
    await page.goto(`/learn/${lesson.id}`);

    await expect(page.getByText("A cloud, not a little ball")).toBeVisible();

    await expect(page.getByLabel("From your material: Aula 5 - Glicolise, slide 3")).toBeVisible();
  });

  test("an explanation no slide supports says it isn't in the material", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const slides = await sourceFixture({
      kind: "upload",
      mimeType: PPTX,
      ownerId: noProgressUser.id,
      title: "Aula 6 - Ciclo de Krebs",
      visibility: "private",
    });

    const { lesson, steps } = await playableLessonFixture({
      lesson: { ownerId: noProgressUser.id, visibility: "private" },
      steps: ["explanation", "check"],
    });

    await prisma.step.update({
      data: { sourceId: slides.id, sourcePage: 5 },
      where: { id: steps[1]?.id },
    });

    await setDeviceMode(page.context(), "focus");
    await page.goto(`/learn/${lesson.id}`);

    await expect(page.getByText("A cloud, not a little ball")).toBeVisible();
    await expect(page.getByText("Not in your material")).toBeVisible();
  });
});
