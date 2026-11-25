import { randomUUID } from "node:crypto";
import { type Page, type Route } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { type SourceReadState } from "@zoonk/db/enums";
import { expectHydrated } from "@zoonk/e2e/hydration";
import { expect, test } from "./fixtures";
import { stopRuns } from "./generation-run";
import { asPersona } from "./learn-personas";

const PHOTO = "Cell cycle notes.jpg";
const NOTES = "Interphase: G1, S and G2.\n\nMitosis: prophase, metaphase, anaphase, telophase.";
const UNREADABLE_LINE = `We couldn't read “${PHOTO}”. Try a sharper photo or paste the text.`;
const DRAFT_URL = /\/start\?draft=[0-9a-f-]{36}$/u;
const THANKS = "Thanks. We're reading it now, and your plan will update in a few minutes.";

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

/** Pastes notes on Start and sends a goal while they're still being added, until `finishAdding`. */
async function sendWhileAdding(page: Page, answer: (route: Route) => Promise<void>) {
  const words = `test on Friday ${randomUUID().slice(0, 8)}`;
  const { promise: added, resolve } = Promise.withResolvers<null>();

  await stopRuns({ page });

  await page.route("**/v1/uploads", async (route) => {
    await added;
    await answer(route);
  });

  await page.goto("/start");

  const attach = page.getByRole("button", { name: "Study your own material" });
  const send = page.getByRole("button", { name: "Build my plan" });

  await expectHydrated(attach);
  await attach.click();
  await page.getByRole("button", { name: "Paste text" }).click();
  await page.getByRole("textbox", { name: "Your text" }).fill(NOTES);
  await page.getByRole("button", { name: "Add text" }).click();
  await expect(page.getByText("Adding your material…")).toBeVisible();

  await page.getByRole("textbox", { name: "I want to" }).fill(words);
  await send.click();
  await expect(send).toHaveAttribute("aria-busy", "true");

  return { finishAdding: () => resolve(null), words };
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
    await expect(attached).not.toContainText("Nothing on it could be read");
    await expect(page.getByText(UNREADABLE_LINE)).toBeHidden();
  });

  test("a photo still being read is checked again once the connection comes back", async ({
    noProgressUser: user,
    userWithoutProgress: page,
  }) => {
    const photo = await addUpload({ readState: "owed", userId: user.id });
    const draft = await addUnderstoodDraft({ sourceIds: [photo.id], userId: user.id });
    const isCheck = (url: string) => url.includes(`/v1/sources/${photo.id}`);
    let failedChecks = 0;

    page.on("requestfailed", (request) => {
      if (isCheck(request.url())) {
        failedChecks += 1;
      }
    });

    await page.clock.install();
    await page.goto(`/start?draft=${draft.id}`);
    await editGoal(page);

    const attached = page.getByRole("list", { name: "Your material" });
    await expect(attached).toContainText(`${PHOTO}, Being read`);

    const firstCheck = page.waitForResponse((response) => isCheck(response.url()));
    await page.clock.runFor(3000);
    await firstCheck;

    await page.context().setOffline(true);

    // Each check is scheduled once the one before it fails, so the clock moves until three have failed.
    await expect(async () => {
      await page.clock.runFor(3000);
      expect(failedChecks).toBeGreaterThanOrEqual(3);
    }).toPass({ timeout: 10_000 });

    await prisma.source.update({
      data: { extractedText: NOTES, readState: "read" },
      where: { id: photo.id },
    });

    await page.context().setOffline(false);

    await expect(async () => {
      await page.clock.runFor(3000);
      await expect(attached).not.toContainText("Being read", { timeout: 500 });
    }).toPass({ timeout: 10_000 });
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
      `${PHOTO}, Nothing on it could be read`,
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
      page.getByText(
        `Your plan and lessons follow only this material. We couldn't read “${PHOTO}”.`,
      ),
    ).toBeVisible();

    await expect(materialRow(page).getByText("Mitosis.txt", { exact: true })).toBeVisible();
    await expect(materialRow(page).getByText(PHOTO, { exact: true })).toBeHidden();
  });

  test("files with nothing to read are called these files on the card and on Start", async ({
    noProgressUser: user,
    userWithoutProgress: page,
  }) => {
    const photo = await addUpload({ readState: "read", userId: user.id });
    const board = await addUpload({ readState: "read", title: "Board.jpg", userId: user.id });
    const draft = await addUnderstoodDraft({ sourceIds: [photo.id, board.id], userId: user.id });

    await page.goto(`/start?draft=${draft.id}`);

    await expect(
      page.getByText("We couldn't read these files, so your plan won't follow them."),
    ).toBeVisible();

    await editGoal(page);

    await expect(
      page.getByText("We couldn't read these files. Try sharper photos or paste the text."),
    ).toBeVisible();
  });

  test("a question sent while the material is read waits for it, then gets its answer", async ({
    noProgressUser: user,
    userWithoutProgress: page,
  }) => {
    const photo = await addUpload({ readState: "owed", userId: user.id });
    const draft = await addUnderstoodDraft({ sourceIds: [photo.id], userId: user.id });
    const refusals: number[] = [];
    let read = false;

    // Real answers while it's read (refused before anything is counted); a faked one after.
    await page.route("**/v1/material-questions", (route) =>
      read
        ? route.fulfill({ json: { answer: "DNA is copied in S.", citations: [] } })
        : route.continue(),
    );

    page.on("response", (response) => {
      if (response.url().endsWith("/v1/material-questions")) {
        refusals.push(response.status());
      }
    });

    await page.goto(`/start?draft=${draft.id}`);
    await editGoal(page);
    await page.getByRole("radio", { name: /^Ask questions/u }).click();
    await page.getByRole("button", { name: "Build my plan" }).click();

    await page.getByRole("textbox", { name: "Your question" }).fill("What happens in S?");
    await page.getByRole("button", { exact: true, name: "Ask" }).click();

    await expect(page.getByText("What happens in S?")).toBeVisible();
    await expect(page.getByText("Reading your material…")).toBeVisible();
    await expect.poll(() => refusals).toContain(409);

    read = true;

    await prisma.source.update({
      data: { extractedText: NOTES, readState: "read" },
      where: { id: photo.id },
    });

    await expect(page.getByText("DNA is copied in S.")).toBeVisible();
    await expect(page.getByText("Reading your material…")).toBeHidden();
  });

  test("a question left waiting for the material comes back to the box to be asked again", async ({
    noProgressUser: user,
    userWithoutProgress: page,
  }) => {
    const photo = await addUpload({ readState: "owed", userId: user.id });
    const refusals: number[] = [];
    let read = false;

    // The photo is added as the learner adds it, so Start stays on its own URL to come back to.
    await page.route("**/v1/uploads", (route) =>
      route.fulfill({
        json: { source: { id: photo.id, readStatus: "reading", title: PHOTO } },
        status: 201,
      }),
    );

    await page.route("**/v1/material-questions", (route) =>
      read
        ? route.fulfill({ json: { answer: "DNA is copied in S.", citations: [] } })
        : route.continue(),
    );

    page.on("response", (response) => {
      if (response.url().endsWith("/v1/material-questions")) {
        refusals.push(response.status());
      }
    });

    await page.clock.install();
    await page.goto("/start");

    const attach = page.getByRole("button", { name: "Study your own material" });

    await expectHydrated(attach);
    await attach.click();
    await page.getByRole("button", { name: "Paste text" }).click();
    await page.getByRole("textbox", { name: "Your text" }).fill(NOTES);
    await page.getByRole("button", { name: "Add text" }).click();
    await expect(page.getByRole("list", { name: "Your material" })).toContainText("Being read");

    await page.getByRole("radio", { name: /^Ask questions/u }).click();
    await page.getByRole("button", { name: "Build my plan" }).click();

    const box = page.getByRole("textbox", { name: "Your question" });

    await box.fill("What happens in S?");
    await page.getByRole("button", { exact: true, name: "Ask" }).click();
    await expect.poll(() => refusals).toContain(409);

    await page.getByRole("link", { exact: true, name: "Level" }).click();
    await expect(page).toHaveURL(/\/level$/u);
    await page.clock.runFor(3000);
    await page.goBack();

    await expect(box).toHaveValue("What happens in S?");
    await expect(page.getByText("Reading your material…")).toBeHidden();

    read = true;
    await page.getByRole("button", { exact: true, name: "Ask" }).click();

    await expect(page.getByText("DNA is copied in S.")).toBeVisible();
    await expect(page.getByText("What happens in S?")).toHaveCount(1);
  });

  test("a goal sent while its material is still being added waits for it and goes with it", async ({
    noProgressUser: user,
    userWithoutProgress: page,
  }) => {
    const { finishAdding, words } = await sendWhileAdding(page, (route) => route.continue());

    finishAdding();

    await expect(page).toHaveURL(DRAFT_URL);

    const [draft, upload] = await Promise.all([
      prisma.onboardingDraft.findFirstOrThrow({ where: { prompt: words } }),
      prisma.learnerSource.findFirstOrThrow({ where: { origin: "upload", userId: user.id } }),
    ]);

    expect(draft.sourceIds).toEqual([upload.sourceId]);
  });

  test("a goal sent while its material fails to be added stays in the box to show why", async ({
    userWithoutProgress: page,
  }) => {
    const { finishAdding, words } = await sendWhileAdding(page, (route) =>
      route.fulfill({ json: {}, status: 503 }),
    );

    finishAdding();

    await expect(page.getByText("We couldn't add that. Try again in a moment.")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "I want to" })).toHaveValue(words);
    await expect(page).toHaveURL(/\/start$/u);
  });

  test("a goal sent while its material is being added isn't sent once the learner leaves and comes back", async ({
    userWithoutProgress: page,
  }) => {
    const { finishAdding, words } = await sendWhileAdding(page, (route) => route.continue());

    // Leaving waits for the material: the navigation's transition ends with the add's.
    await page.getByRole("link", { exact: true, name: "Level" }).click();
    finishAdding();
    await expect(page).toHaveURL(/\/level$/u);

    const actions: string[] = [];

    page.on("request", (request) => {
      if (request.headers()["next-action"]) {
        actions.push(request.url());
      }
    });

    await page.goBack();
    await expect(page.getByRole("list", { name: "Your material" })).toBeVisible();

    const send = page.getByRole("button", { name: "Build my plan" });

    await expect(send).toBeEnabled();
    await expect(send).not.toHaveAttribute("aria-busy", "true");
    await expect(page.getByRole("textbox", { name: "I want to" })).toHaveValue(words);
    await expect(page).toHaveURL(/\/start$/u);
    expect(actions).toEqual([]);
    await expect(prisma.onboardingDraft.count({ where: { prompt: words } })).resolves.toBe(0);
  });
});

async function openUploads(page: Page) {
  await page.goto("/today");
  await pasteNotes(page);
}

async function pasteNotes(page: Page) {
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

      const thanks = page.getByText(THANKS).filter({ visible: true }).first();

      await expect(thanks).toBeVisible();
      expect(answers).toHaveLength(1);

      await prisma.source.update({ data: { readState: "read" }, where: { id: photo.id } });

      await expect(page.getByText(UNREADABLE_LINE).filter({ visible: true }).first()).toBeVisible();
      await expect(thanks).toBeHidden();
    });
  });

  test("asks again when the same upload, sent again, still has nothing to read", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "stocks" }, async ({ page, user }) => {
      await prisma.goal.update({
        data: { researchUploadReason: "noOfficialSource" },
        where: { id: user.goalId },
      });

      const photo = await addUpload({ readState: "owed", userId: user.id });
      const answers = await attachAs(page, { id: photo.id, readStatus: "reading" });
      const thanks = page.getByText(THANKS).filter({ visible: true }).first();
      const unreadable = page.getByText(UNREADABLE_LINE).filter({ visible: true }).first();

      await openUploads(page);
      await page.getByRole("button", { name: "Add text" }).click();
      await expect(thanks).toBeVisible();

      await prisma.source.update({ data: { readState: "failed" }, where: { id: photo.id } });
      await expect(unreadable).toBeVisible();

      // Sending it again owes its reading again, and the upload answers with the same source.
      await prisma.source.update({ data: { readState: "owed" }, where: { id: photo.id } });
      await pasteNotes(page);
      await page.getByRole("button", { name: "Add text" }).click();
      await expect(thanks).toBeVisible();
      expect(answers).toHaveLength(2);

      await prisma.source.update({ data: { readState: "failed" }, where: { id: photo.id } });
      await expect(unreadable).toBeVisible();
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

  test("stops checking the upload once it's read", async ({ browser }) => {
    await asPersona(browser, { persona: "stocks" }, async ({ page, user }) => {
      await prisma.goal.update({
        data: { researchUploadReason: "noOfficialSource" },
        where: { id: user.goalId },
      });

      const photo = await addUpload({ readState: "owed", userId: user.id });
      const checks: string[] = [];
      const isCheck = (url: string) => url.includes(`/v1/sources/${photo.id}`);

      page.on("request", (request) => {
        if (isCheck(request.url())) {
          checks.push(request.url());
        }
      });

      await attachAs(page, { id: photo.id, readStatus: "reading" });
      await page.clock.install();
      await openUploads(page);
      await page.getByRole("button", { name: "Add text" }).click();

      const thanks = page.getByText(THANKS).filter({ visible: true }).first();
      await expect(thanks).toBeVisible();

      await prisma.source.update({
        data: { extractedText: NOTES, readState: "read" },
        where: { id: photo.id },
      });

      const readable = page.waitForResponse(async (response) => {
        const body = isCheck(response.url()) ? await response.text() : "";
        return body.includes('"readable"');
      });

      await page.clock.runFor(3000);
      await readable;

      const checksWhenRead = checks.length;

      // Separate runs give the page time to schedule another check between them, if it would.
      await page.clock.runFor(3000);
      await page.clock.runFor(3000);
      await page.clock.runFor(3000);

      expect(checks).toHaveLength(checksWhenRead);
      await expect(thanks).toBeVisible();
    });
  });
});
