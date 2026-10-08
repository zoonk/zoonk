import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { goalUnderstandingFixture } from "@zoonk/testing/fixtures/goal-understandings";
import { learnerSourceFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { type Page, expect, test } from "./fixtures";

/**
 * Studying your own material: the paperclip takes a file, pasted text or a link, then "What do you
 * want to do?" turns it into an exam plan, lessons built from it, or answers from its pages. The
 * uploads and questions APIs are external here (Blob storage and a model), so they answer as they
 * would.
 */

const PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

/** A class test this week: Friday's, as a learner would set it. */
const TEST_IN_DAYS = 3;

/** The learner's day `days` from today, as the date field takes it. */
function isoDateIn(days: number): string {
  return new Date(Date.now() + days * MS_PER_DAY).toISOString().slice(0, 10);
}

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

    // The card says the plan is built from what they gave, before they confirm it.
    const materialRow = page.getByRole("listitem").filter({ hasText: "Your material" });
    await expect(materialRow.getByText(title)).toBeVisible();
    await expect(materialRow.getByText("Your plan and lessons follow this material")).toBeVisible();

    const goal = await confirmGoal(page, prompt);

    expect(goal.details).toMatchObject({ materialIntent: "exam" });

    // A class test is only passed, so there's no target to ask; no notice gives its date, so
    // that comes first.
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

    // A class test three days away starts at a short study time, not a public exam's hours.
    await page.getByRole("textbox", { name: "Date" }).fill(isoDateIn(TEST_IN_DAYS));
    await page.getByRole("button", { exact: true, name: "Continue" }).click();

    await expect(
      page.getByRole("heading", { name: "How much do you already know?" }),
    ).toBeVisible();

    await page.getByText("The basics").click();
    await page.getByRole("button", { exact: true, name: "Continue" }).click();

    // The time comes after the profile (birth and buddy) and placement.
    await expect(page.getByRole("heading", { name: "When were you born?" })).toBeVisible();
    await page.getByLabel("Month").selectOption("3");
    await page.getByLabel("Year").selectOption("1990");
    await page.getByRole("button", { exact: true, name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Choose your buddy" })).toBeVisible();
    await page.getByRole("button", { exact: true, name: "Continue" }).click();
    await page.getByRole("button", { name: "Start from zero" }).click();

    await expect(
      page.getByRole("heading", { name: "How much time can you study each day?" }),
    ).toBeVisible();

    await expect(page.getByRole("radio", { exact: true, name: "45 min" })).toBeChecked();
  });

  test("a pasted link to a public page becomes lessons that teach it", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const title = `enem.inep.gov.br/edital-${randomUUID().slice(0, 6)}`;
    const notice = await sourceFixture({ kind: "upload", title, visibility: "public" });
    await learnerSourceFixture({ sourceId: notice.id, userId: noProgressUser.id });
    await stubUpload(page, { id: notice.id, title });

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

  test("a failed upload's message goes once the learner pastes their notes instead", async ({
    userWithoutProgress: page,
  }) => {
    await page.route("**/v1/uploads/tokens", (route) =>
      route.fulfill({ json: { error: "Not configured" }, status: 500 }),
    );

    await openPaperclip(page);

    await page
      .getByLabel("Upload a file")
      .setInputFiles({
        buffer: Buffer.from("%PDF-1.4"),
        mimeType: "application/pdf",
        name: "resumo-celula.pdf",
      });

    const failed = page.getByText("We couldn't add that. Try again in a moment.");
    await expect(failed).toBeVisible();

    await page.getByRole("button", { name: "Paste text" }).click();

    await expect(page.getByRole("textbox", { name: "Your text" })).toBeVisible();
    await expect(failed).toBeHidden();
  });

  test("past the free plan's material for the month, the paperclip says when it comes back and offers Plus", async ({
    userWithoutProgress: page,
  }) => {
    await page.route("**/v1/uploads", (route) =>
      route.fulfill({
        json: {
          error: {
            code: "USAGE_LIMIT_REACHED",
            details: { limit: { limit: 10, period: "month", resource: "upload", tier: "free" } },
            message: "This plan's limit is reached",
          },
        },
        status: 402,
      }),
    );

    await openPaperclip(page);
    await page.getByRole("button", { name: "Paste text" }).click();
    await page.getByRole("textbox", { name: "Your text" }).fill("Glycolysis nets 2 ATP.");
    await page.getByRole("button", { name: "Add text" }).click();

    await expect(
      page.getByText(
        "You've added as much material as the free plan allows this month. Try again next month, or get Plus to keep going now.",
      ),
    ).toBeVisible();

    await expect(page.getByRole("list", { name: "Your material" })).toBeHidden();
  });
});
