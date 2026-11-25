import { randomUUID } from "node:crypto";
import { type Page } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { type SourceReadState } from "@zoonk/db/enums";
import { expectHydrated } from "@zoonk/e2e/hydration";
import { expect, test } from "./fixtures";
import { stopRuns } from "./generation-run";
import { asPersona } from "./learn-personas";

const PHOTO = "Cell cycle notes.jpg";
const NOTES = "Interphase: G1, S and G2.\n\nMitosis: prophase, metaphase, anaphase, telophase.";
const UNREADABLE_LINE = `We couldn't read “${PHOTO}”. Try a sharper photo or paste the text.`;

async function addUpload({
  extractedText = null,
  readState = null,
  title = PHOTO,
  userId,
}: {
  extractedText?: string | null;
  readState?: SourceReadState | null;
  title?: string;
  userId: string;
}) {
  const source = await prisma.source.create({
    data: {
      contentHash: randomUUID(),
      extractedText,
      fetchedAt: new Date(),
      identityKey: `upload:${randomUUID()}`,
      kind: "upload",
      language: "en",
      mimeType: title.endsWith(".jpg") ? "image/jpeg" : "text/plain",
      ownerId: userId,
      readState,
      title,
      visibility: "private",
    },
  });

  await prisma.learnerSource.create({ data: { origin: "upload", sourceId: source.id, userId } });

  return source;
}

/** A goal card read from "test on Friday" sent with the material. */
async function addUnderstoodDraft({ sourceIds, userId }: { sourceIds: string[]; userId: string }) {
  const prompt = "test on Friday";

  const draft = await prisma.onboardingDraft.create({
    data: {
      language: "en",
      materialIntent: "exam",
      prompt,
      sourceIds,
      status: "understood",
      timeZone: "UTC",
      userId,
    },
  });

  await prisma.onboardingDraft.update({
    data: {
      understanding: {
        goals: [
          {
            draft: {
              details: { onboardingId: draft.id, subject: "the cell cycle" },
              displayName: "Cell cycle",
              kind: "exam",
              language: "en",
              prompt,
              title: "Pass the cell cycle test",
            },
            examDates: [],
          },
        ],
        schedule: { dailyMinutes: 15, studyDays: null, studyTime: null, studyTimeNote: null },
        status: "goals",
      },
    },
    where: { id: draft.id },
  });

  return draft;
}

function materialRow(page: Page) {
  return page.getByText("Your material", { exact: true }).locator("..");
}

async function editGoal(page: Page) {
  const back = page.getByRole("button", { exact: true, name: "Back" });
  await expectHydrated(back);
  await back.click();
}

test.describe("Material that's read after it's added", () => {
  test("a photo still being read spins on Start and turns into a plain file once read", async ({
    noProgressUser: user,
    userWithoutProgress: page,
  }) => {
    const photo = await addUpload({ readState: "owed", userId: user.id });
    const draft = await addUnderstoodDraft({ sourceIds: [photo.id], userId: user.id });

    await page.goto(`/start?draft=${draft.id}`);

    await expect(materialRow(page)).toContainText(PHOTO);
    await expect(page.getByText("Your plan and lessons follow this material")).toBeVisible();

    await editGoal(page);

    const attached = page.getByRole("list", { name: "Your material" });

    await expect(attached).toContainText(`${PHOTO}, Being read`);
    await expect(page.getByRole("button", { name: "Build my plan" })).toBeEnabled();

    await prisma.source.update({
      data: { extractedText: NOTES, readState: "read" },
      where: { id: photo.id },
    });

    await expect(attached).not.toContainText("Being read");
    await expect(attached).not.toContainText("Can't be read");
    await expect(page.getByText(UNREADABLE_LINE)).toBeHidden();
  });

  test("a photo with nothing to read says so on the card and on Start, and still goes with the goal", async ({
    noProgressUser: user,
    userWithoutProgress: page,
  }) => {
    const photo = await addUpload({ readState: "read", userId: user.id });
    const draft = await addUnderstoodDraft({ sourceIds: [photo.id], userId: user.id });

    await page.goto(`/start?draft=${draft.id}`);

    await expect(materialRow(page)).toContainText(PHOTO);

    await expect(
      page.getByText("We couldn't read it, so your plan won't follow it."),
    ).toBeVisible();

    await editGoal(page);

    await expect(page.getByRole("list", { name: "Your material" })).toContainText(
      `${PHOTO}, Can't be read`,
    );

    await expect(page.getByText(UNREADABLE_LINE)).toBeVisible();

    const words = `test on Friday ${randomUUID().slice(0, 8)}`;
    await stopRuns({ page });
    await page.getByRole("textbox", { name: "I want to" }).fill(words);
    await page.getByRole("button", { name: "Build my plan" }).click();

    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();

    await expect(
      prisma.onboardingDraft.findFirstOrThrow({ where: { prompt: words, userId: user.id } }),
    ).resolves.toMatchObject({ materialIntent: "exam", sourceIds: [photo.id] });
  });

  test("the card lists only what the plan follows when some of the material can't be read", async ({
    noProgressUser: user,
    userWithoutProgress: page,
  }) => {
    const photo = await addUpload({ readState: "read", userId: user.id });
    const notes = await addUpload({ extractedText: NOTES, title: "Mitosis.txt", userId: user.id });

    const draft = await addUnderstoodDraft({ sourceIds: [photo.id, notes.id], userId: user.id });

    await page.goto(`/start?draft=${draft.id}`);

    await expect(
      page.getByText("Your plan and lessons follow only this material. We couldn't read the rest."),
    ).toBeVisible();

    await expect(materialRow(page)).toContainText("Mitosis.txt");
    await expect(materialRow(page)).not.toContainText(PHOTO);
  });
});

async function openUploads(page: Page) {
  await page.goto("/today");

  const upload = page.getByRole("button", { name: "Upload a document" });
  const open = page.getByRole("button", { exact: true, name: "Upload" });

  await expect(upload.or(open).first()).toBeVisible();

  if (!(await upload.isVisible())) {
    await open.click();
  }

  await upload.click();
  await page.getByRole("button", { name: "Paste text" }).click();
  await page.getByRole("textbox", { name: "Your text" }).fill("My notes");
}

/** The upload and the answer are faked, so the card follows a seeded source; its reads are real. */
async function attachAs(page: Page, source: { id: string; readStatus: string }) {
  const answers: string[] = [];

  await page.route("**/v1/uploads", (route) =>
    route.fulfill({ json: { source: { ...source, title: PHOTO } }, status: 201 }),
  );

  await page.route("**/v1/research", (route) => {
    answers.push(route.request().postData() ?? "");
    return route.fulfill({ json: {}, status: 202 });
  });

  return answers;
}

test.describe("Today's upload request with material that's read after it's added", () => {
  test("asks again with a hint once nothing could be read on the upload", async ({ browser }) => {
    await asPersona(browser, { persona: "stocks" }, async ({ page, user }) => {
      await prisma.goal.update({
        data: { researchUploadReason: "noOfficialSource" },
        where: { id: user.goalId },
      });

      const photo = await addUpload({ readState: "owed", userId: user.id });
      const answers = await attachAs(page, { id: photo.id, readStatus: "reading" });

      await openUploads(page);
      await page.getByRole("button", { name: "Add text" }).click();

      const thanks = page
        .getByText("Thanks. We're reading it now, and your plan will update in a few minutes.")
        .filter({ visible: true })
        .first();

      await expect(thanks).toBeVisible();
      expect(answers).toHaveLength(1);

      await prisma.source.update({ data: { readState: "read" }, where: { id: photo.id } });

      await expect(page.getByText(UNREADABLE_LINE).filter({ visible: true }).first()).toBeVisible();
      await expect(thanks).toBeHidden();
    });
  });

  test("doesn't answer with an upload that has nothing to read", async ({ browser }) => {
    await asPersona(browser, { persona: "stocks" }, async ({ page, user }) => {
      await prisma.goal.update({
        data: { researchUploadReason: "noOfficialSource" },
        where: { id: user.goalId },
      });

      const photo = await addUpload({ readState: "read", userId: user.id });
      const answers = await attachAs(page, { id: photo.id, readStatus: "unreadable" });

      await openUploads(page);
      await page.getByRole("button", { name: "Add text" }).click();

      await expect(page.getByText(UNREADABLE_LINE).filter({ visible: true }).first()).toBeVisible();
      await expect(page.getByRole("button", { name: "Upload a document" })).toBeVisible();
      expect(answers).toHaveLength(0);
    });
  });
});
