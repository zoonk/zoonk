import { randomUUID } from "node:crypto";
import { type Browser, type Locator } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { sourceFixture } from "@zoonk/testing/fixtures/sources";
import { type Page, expect, test } from "./fixtures";
import { createStudyDay, openAs } from "./study-day";

/**
 * When research couldn't find (or confirm) what an exam goal is built from, Today asks the learner
 * for it. Uploads and research run on the API, an external boundary here: the uploads
 * route answers with the learner's stored upload, and research takes the answer as it would.
 */

type Reason = "noOfficialSource" | "unverified";

async function studyDayWaitingFor(reason: Reason) {
  const day = await createStudyDay();

  await prisma.goal.update({ data: { researchUploadReason: reason }, where: { id: day.goal.id } });

  return day;
}

/** What `POST /v1/uploads` returns once the learner's pasted notice is stored. */
async function stubUpload({ page, userId }: { page: Page; userId: string }) {
  const contentHash = `hash-${randomUUID()}`;

  const upload = await sourceFixture({
    contentHash,
    identityKey: `private:${userId}:upload:${contentHash}`,
    kind: "upload",
    ownerId: userId,
    title: "Edital TCDF 2026",
    url: null,
    visibility: "private",
  });

  await page.route("**/v1/uploads", (route) =>
    route.fulfill({
      json: { checkingVisibility: true, source: { id: upload.id, title: upload.title } },
      status: 201,
    }),
  );

  return upload;
}

/**
 * `POST /v1/research` as the API answers it: research started with the learner's upload, and the
 * goal's ask answered, so Today no longer asks for anything.
 */
async function stubResearch({
  goalId,
  page,
}: {
  goalId: string;
  page: Page;
}): Promise<() => unknown> {
  const bodies: unknown[] = [];

  await page.route("**/v1/research", async (route) => {
    bodies.push(route.request().postDataJSON());
    await prisma.goal.update({ data: { researchUploadReason: null }, where: { id: goalId } });

    await route.fulfill({
      json: { id: "research-run", result: null, status: "running" },
      status: 202,
    });
  });

  return () => bodies.at(-1);
}

/**
 * The learner uploads the notice research asked for on Today in one tab, with Today open in
 * another too: research has the upload and the ask is answered, but its reply waits until the
 * test lets it (`reply`).
 */
async function uploadWithReplyHeld(browser: Browser) {
  const { goal, user } = await studyDayWaitingFor("noOfficialSource");
  const page = await openAs(browser, user);
  const other = await page.context().newPage();
  await page.setViewportSize({ height: 900, width: 900 });
  await other.setViewportSize({ height: 900, width: 1280 });
  await stubUpload({ page, userId: user.id });

  const reply = Promise.withResolvers<null>();

  await page.route("**/v1/research", async (route) => {
    await prisma.goal.update({ data: { researchUploadReason: null }, where: { id: goal.id } });
    await reply.promise;

    await route.fulfill({
      json: { id: "research-run", result: null, status: "running" },
      status: 202,
    });
  });

  await page.goto("/today");
  await other.goto("/today");

  const ask = page.getByRole("region", { name: "Your plan needs a document" });
  await ask.getByRole("button", { exact: true, name: "Upload" }).click();
  const sheet = page.getByRole("dialog", { name: "Your plan needs a document" });
  await sheet.getByRole("button", { name: "Upload the notice" }).click();
  await sheet.getByRole("button", { name: "Paste text" }).click();
  await sheet.getByRole("textbox", { name: "Your text" }).fill("Edital nº 1: 120 questões.");

  const research = page.waitForRequest("**/v1/research");
  await sheet.getByRole("button", { name: "Add text" }).click();
  await research;

  return { ask, goal, other, page, reply };
}

/**
 * "Not now" in the other tab, and the first tab reads Today again, before its upload answered: the
 * ask is gone there, its upload sheet with it (an open sheet alone hides the ask from roles).
 */
async function takeAskAwayElsewhere({ other, page }: { other: Page; page: Page }) {
  const reread = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/learner/views/today",
  );

  await other
    .getByRole("region", { name: "Your plan needs a document" })
    .getByRole("button", { name: "Not now" })
    .click();

  await reread;
  await expect(page.getByRole("dialog", { name: "Your plan needs a document" })).toHaveCount(0);
}

/** The upload's thanks, with nothing left to answer. */
async function expectThanksOnly(ask: Locator) {
  await expect(ask.getByRole("status").filter({ visible: true })).toHaveText(
    "Thanks. We're reading it now, and your plan will update in a few minutes.",
  );

  await expect(ask.getByRole("button", { exact: true, name: "Upload" })).toHaveCount(0);
  await expect(ask.getByRole("button", { name: "Not now" })).toHaveCount(0);
}

test.describe("Asking for the notice research couldn't find", () => {
  test("Today asks for the notice, and uploading it sends it to research", async ({ browser }) => {
    const { goal, user } = await studyDayWaitingFor("noOfficialSource");
    const page = await openAs(browser, user);
    await page.setViewportSize({ height: 900, width: 900 });
    const upload = await stubUpload({ page, userId: user.id });
    const lastResearch = await stubResearch({ goalId: goal.id, page });

    await page.goto("/today");

    const ask = page.getByRole("region", { name: "Your plan needs a document" });
    await expect(ask).toContainText("We couldn't find the official notice");
    await expectAccessibleScreen(page, "Today asking for the notice");

    await ask.getByRole("button", { exact: true, name: "Upload" }).click();
    const sheet = page.getByRole("dialog", { name: "Your plan needs a document" });
    await expect(sheet).toContainText("Upload the notice so your plan follows the real exam.");
    await sheet.getByRole("button", { name: "Upload the notice" }).click();
    await sheet.getByRole("button", { name: "Paste text" }).click();
    await sheet.getByRole("textbox", { name: "Your text" }).fill("Edital nº 1: 120 questões.");

    // The answer makes Today read itself again, and the ask is gone from that read: the thanks
    // stays while the learner is here.
    const viewRead = page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/api/learner/views/today",
    );

    await sheet.getByRole("button", { name: "Add text" }).click();

    await expect(ask.getByRole("status").filter({ visible: true })).toHaveText(
      "Thanks. We're reading it now, and your plan will update in a few minutes.",
    );

    await viewRead;

    await expect(ask.getByRole("status").filter({ visible: true })).toHaveText(
      "Thanks. We're reading it now, and your plan will update in a few minutes.",
    );

    await expect(sheet).toBeHidden();

    // The settled answer belongs to the request, including the previously hidden desktop panel.
    await page.setViewportSize({ height: 900, width: 1280 });

    await expect(ask.getByRole("status")).toHaveText(
      "Thanks. We're reading it now, and your plan will update in a few minutes.",
    );

    await expect(ask.getByRole("button", { name: "Upload the notice" })).toHaveCount(0);
    await expect(ask.getByRole("button", { name: "Not now" })).toHaveCount(0);

    expect(lastResearch()).toStrictEqual({ goalId: goal.id, sourceIds: [upload.id] });
    await page.context().close();
  });

  // Bia uploaded the notice in one tab, and said "Not now" in another before the upload answered:
  // the first tab asked for the notice again, though research already had it.
  test("keeps the thanks for an upload that answered after another tab took the ask away", async ({
    browser,
  }) => {
    const { ask, other, page, reply } = await uploadWithReplyHeld(browser);

    await takeAskAwayElsewhere({ other, page });
    await expect(ask).toHaveCount(0);
    reply.resolve(null);

    await expectThanksOnly(ask);
    await page.context().close();
  });

  // The same, but research asked again, and the first tab showed that ask before its upload
  // answered: it kept asking, with Upload and Not now, though research had the upload.
  test("keeps the thanks for an upload that answered after research asked again", async ({
    browser,
  }) => {
    const { ask, goal, other, page, reply } = await uploadWithReplyHeld(browser);

    await takeAskAwayElsewhere({ other, page });
    await expect(ask).toHaveCount(0);

    // Research asks again, and the other tab's start of the day makes this one read Today.
    await prisma.goal.update({
      data: { researchUploadReason: "unverified" },
      where: { id: goal.id },
    });

    await other
      .getByRole("region", { name: "Today's session" })
      .getByRole("button", { name: /^Start/u })
      .click();

    await expect(ask).toContainText("We couldn't confirm the exam's details");
    reply.resolve(null);

    await expectThanksOnly(ask);
    await page.context().close();
  });

  test(`Today asks for nothing until research needs something, says what it needs, and "Not now" takes the ask away`, async ({
    browser,
  }) => {
    const { goal, user } = await createStudyDay();
    const page = await openAs(browser, user);
    await page.setViewportSize({ height: 900, width: 1280 });
    const ask = page.getByRole("region", { name: "Your plan needs a document" });

    await page.goto("/today");

    await expect(page.getByRole("region", { name: "Today's session" })).toBeVisible();
    await expect(ask).toBeHidden();

    // A teacher's test asks for the class's material.
    await prisma.goal.update({
      data: { researchUploadReason: "classMaterial" },
      where: { id: goal.id },
    });

    await page.reload();

    await expect(ask).toContainText("Add your class material");
    await expect(ask).toContainText("Upload the slides, notes or list of topics");
    await expect(ask.getByRole("button", { name: "Upload your material" })).toBeVisible();

    // A notice research couldn't confirm asks for the official one, until "Not now".
    await prisma.goal.update({
      data: { researchUploadReason: "unverified" },
      where: { id: goal.id },
    });

    await page.reload();

    await expect(ask).toContainText("We couldn't confirm the exam's details");
    await expect(ask).toContainText("Upload the official notice");

    await ask.getByRole("button", { name: "Not now" }).click();
    await expect(ask).toBeHidden();

    await expect
      .poll(async () => {
        const stored = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
        return stored.researchUploadReason;
      })
      .toBeNull();

    await page.reload();
    await expect(page.getByRole("region", { name: "Today's session" })).toBeVisible();
    await expect(ask).toBeHidden();
    await page.context().close();
  });
});
