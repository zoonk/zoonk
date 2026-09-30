import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { expectAccessibleRoutes } from "@zoonk/e2e/fixtures/accessibility";
import { sourceFixture } from "@zoonk/testing/fixtures/sources";
import { type Page, expect, test } from "./fixtures";
import { type Mode } from "./learn-personas";
import { createStudyDay, openAs } from "./study-day";

/**
 * When research couldn't find (or confirm) what an exam goal is built from, Plan and Today ask the
 * learner for it. Uploads and research run on the API, an external boundary here: the uploads
 * route answers with the learner's stored upload, and research takes the answer as it would.
 */

type Reason = "classMaterial" | "noOfficialSource" | "unverified";

/** Two screens, each at two widths in light and dark. */
const ACCESSIBILITY_TIMEOUT_MS = 120_000;

/** Scans wait for the ask, which streams in with the rest of the screen. */
async function askIsShown(page: Page) {
  await expect(
    page.getByRole("region", { name: "We couldn't find the official notice" }),
  ).toBeVisible();
}

async function studyDayWaitingFor(reason: Reason, mode: Mode = "focus") {
  const day = await createStudyDay({ mode });

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

/** `POST /v1/research` as the API answers it: research started with the learner's upload. */
async function stubResearch(page: Page): Promise<() => unknown> {
  const bodies: unknown[] = [];

  await page.route("**/v1/research", async (route) => {
    bodies.push(route.request().postDataJSON());

    await route.fulfill({
      json: { id: "research-run", result: null, status: "running" },
      status: 202,
    });
  });

  return () => bodies.at(-1);
}

test.describe("Asking for the notice research couldn't find", () => {
  test("Today asks for the notice, and uploading it sends it to research", async ({ browser }) => {
    const { goal, user } = await studyDayWaitingFor("noOfficialSource", "focus");
    const page = await openAs(browser, user);
    const upload = await stubUpload({ page, userId: user.id });
    const lastResearch = await stubResearch(page);

    await page.goto("/today");

    const ask = page.getByRole("region", { name: "We couldn't find the official notice" });
    await expect(ask).toContainText("Upload it so your plan follows the real exam.");

    await ask.getByRole("button", { name: "Upload the notice" }).click();
    await ask.getByRole("button", { name: "Paste text" }).click();
    await ask.getByRole("textbox", { name: "Your text" }).fill("Edital nº 1: 120 questões.");
    await ask.getByRole("button", { name: "Add text" }).click();

    await expect(
      ask.getByText("Thanks. We're reading it now, and your plan will update in a few minutes."),
    ).toBeVisible();

    await expect(ask.getByRole("button", { name: "Upload the notice" })).toBeHidden();

    expect(lastResearch()).toStrictEqual({ goalId: goal.id, sourceIds: [upload.id] });
    await page.context().close();
  });

  test(`Plan asks too, and "Not now" takes the ask away`, async ({ browser }) => {
    const { goal, user } = await studyDayWaitingFor("unverified", "fun");
    const page = await openAs(browser, user);

    await page.goto("/plan");

    const ask = page.getByRole("region", { name: "We couldn't confirm the exam's details" });
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
    await expect(page.getByRole("button", { name: "Share this plan" })).toBeVisible();
    await expect(page.getByRole("region", { name: /exam's details/u })).toBeHidden();
    await page.context().close();
  });

  test("the ask is accessible on Today and Plan, light and dark, in Focus", async ({ browser }) => {
    test.setTimeout(ACCESSIBILITY_TIMEOUT_MS);

    const { user } = await studyDayWaitingFor("noOfficialSource", "focus");
    const page = await openAs(browser, user);

    await expectAccessibleRoutes(page, [
      { path: "/today", ready: askIsShown },
      { path: "/plan", ready: askIsShown },
    ]);

    await page.context().close();
  });

  test("the ask is accessible on Today and Plan, light and dark, in Fun", async ({ browser }) => {
    test.setTimeout(ACCESSIBILITY_TIMEOUT_MS);

    const { user } = await studyDayWaitingFor("noOfficialSource", "fun");
    const page = await openAs(browser, user);

    await expectAccessibleRoutes(page, [
      { path: "/today", ready: askIsShown },
      { path: "/plan", ready: askIsShown },
    ]);

    await page.context().close();
  });

  test("a teacher's test asks for the class's material", async ({ browser }) => {
    const { user } = await studyDayWaitingFor("classMaterial");
    const page = await openAs(browser, user);

    await page.goto("/today");

    const ask = page.getByRole("region", { name: "Add your class material" });
    await expect(ask).toContainText("Upload the slides, notes or list of topics");
    await expect(ask.getByRole("button", { name: "Upload your material" })).toBeVisible();
    await page.context().close();
  });

  test("Today asks for nothing when research needs nothing", async ({ browser }) => {
    const { user } = await createStudyDay({ mode: "focus" });
    const page = await openAs(browser, user);

    await page.goto("/today");

    await expect(page.getByRole("region", { name: "Today's session" })).toBeVisible();
    await expect(page.getByRole("region", { name: /official notice/u })).toBeHidden();
    await page.context().close();
  });
});
