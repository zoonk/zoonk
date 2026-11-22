import { type Page } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "./fixtures";
import { openAs } from "./study-day";
import { POINTS_GRADE, createWrittenExamDay } from "./written-exam-fixtures";

const MAX_ESSAY_CHARACTERS = 48_000;

async function savedDraftText(blockId: string): Promise<string | null> {
  const block = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: blockId } });
  const payload: unknown = block.payload;

  if (typeof payload !== "object" || payload === null || !("writing" in payload)) {
    return null;
  }

  const { writing } = payload;

  return typeof writing === "object" &&
    writing !== null &&
    "draft" in writing &&
    typeof writing.draft === "object" &&
    writing.draft !== null &&
    "text" in writing.draft &&
    typeof writing.draft.text === "string"
    ? writing.draft.text
    : null;
}

async function admissionOf(blockId: string): Promise<string> {
  const block = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: blockId } });
  const payload: unknown = block.payload;

  if (
    typeof payload === "object" &&
    payload !== null &&
    "writing" in payload &&
    typeof payload.writing === "object" &&
    payload.writing !== null &&
    "admissionId" in payload.writing &&
    typeof payload.writing.admissionId === "string"
  ) {
    return payload.writing.admissionId;
  }

  throw new Error("Expected an admitted writing block");
}

function isDraftSave(page: Page, status: (code: number) => boolean) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      response.url().endsWith("/draft") &&
      status(response.status()),
  );
}

/** Today's tap admits the question; the editor opens on it. */
async function openEditor(page: Page) {
  await page.goto("/today");
  await page.getByRole("button", { name: "Start" }).click();
  await page.getByRole("button", { exact: true, name: "Write" }).click();
  return page.getByLabel("Your answer");
}

test.describe("Written answer drafts", () => {
  test("a device with an older copy asks before replacing a newer draft, and replaces nothing until answered", async ({
    browser,
  }) => {
    const day = await createWrittenExamDay();

    const [first, second] = await Promise.all([
      openAs(browser, day.user),
      openAs(browser, day.user),
    ]);

    try {
      const firstField = await openEditor(first);
      await second.goto(`/essay/${day.blockId}`);
      await second.getByRole("button", { exact: true, name: "Write" }).click();
      const secondField = second.getByLabel("Your answer");

      const saved = isDraftSave(first, (code) => code === 200);
      await firstField.fill("New server draft");
      await saved;

      const conflict = isDraftSave(second, (code) => code === 409);
      await secondField.fill("Stale device draft");
      await conflict;

      const dialog = second.getByRole("alertdialog", {
        name: "This answer changed on another device",
      });

      await expect(dialog).toBeVisible();
      await expect(secondField).toHaveValue("Stale device draft");
      expect(await savedDraftText(day.blockId)).toBe("New server draft");

      const keep = dialog.getByRole("button", { name: "Keep this one" });
      await expect(keep).toBeFocused();
      await second.keyboard.press("Escape");
      await expect(dialog).toBeVisible();
      await expect(keep).toBeFocused();
      await expect(secondField).toHaveValue("Stale device draft");
      expect(await savedDraftText(day.blockId)).toBe("New server draft");

      await second.keyboard.press("Enter");
      await expect.poll(() => savedDraftText(day.blockId)).toBe("Stale device draft");

      // The first device's next save finds it, asks, and takes it on "Use the other".
      const secondConflict = isDraftSave(first, (code) => code === 409);
      await firstField.fill("New server draft, edited");
      await secondConflict;

      await first
        .getByRole("alertdialog", { name: "This answer changed on another device" })
        .getByRole("button", { name: "Use the other" })
        .click();

      await expect(firstField).toHaveValue("Stale device draft");
      expect(await savedDraftText(day.blockId)).toBe("Stale device draft");
    } finally {
      await Promise.all([first.context().close(), second.context().close()]);
    }
  });

  test("a save's answer keeps what was typed while it was out", async ({ browser }) => {
    const day = await createWrittenExamDay();
    const page = await openAs(browser, day.user);

    try {
      const field = await openEditor(page);
      const { promise: held, resolve: release } = Promise.withResolvers<null>();
      let saves = 0;

      // The first save is held, and every later one fails, so the device's copy is all there is.
      await page.route("**/draft", async (route) => {
        saves += 1;

        if (saves > 1) {
          await route.abort();
          return;
        }

        await held;
        await route.continue();
      });

      const firstSave = page.waitForRequest((request) => request.url().endsWith("/draft"));
      await field.fill("first");
      await firstSave;
      await field.fill("first plus new paragraph");

      const answered = page.waitForResponse((response) => response.url().endsWith("/draft"));
      release(null);
      await answered;

      await expect(page.getByText("Not saved yet. It's kept on this device.")).toBeVisible();

      const kept = await page.evaluate(
        (key) => localStorage.getItem(key),
        `writing:${day.blockId}`,
      );

      expect(kept).toContain("first plus new paragraph");
      expect(await savedDraftText(day.blockId)).toBe("first");
    } finally {
      await page.context().close();
    }
  });

  test("a save in one tab preserves the unsaved answer in another tab", async ({ browser }) => {
    const day = await createWrittenExamDay();
    const first = await openAs(browser, day.user);
    const context = first.context();
    const { promise: held, resolve: release } = Promise.withResolvers<null>();

    try {
      const firstField = await openEditor(first);
      const second = await context.newPage();
      await second.goto(`/essay/${day.blockId}`);
      await second.getByRole("button", { exact: true, name: "Write" }).click();

      await first.route("**/draft", async (route) => {
        await held;
        await route.continue();
      });

      await second.route("**/draft", (route) => route.abort());

      const sending = first.waitForRequest((request) => request.url().endsWith("/draft"));
      await firstField.fill("First tab");
      await sending;
      await second.getByLabel("Your answer").fill("Unsaved in the second tab");
      await expect(second.getByText("Not saved yet. It's kept on this device.")).toBeVisible();

      release(null);
      await first.getByRole("link", { exact: true, name: "Leave" }).click();
      await expect(first).toHaveURL(/\/today/u);
      expect(await savedDraftText(day.blockId)).toBe("First tab");

      const kept = await second.evaluate(
        (id) => localStorage.getItem(`writing:${id}`),
        day.blockId,
      );

      expect(kept).toContain("Unsaved in the second tab");
    } finally {
      release(null);
      await context.close();
    }
  });

  test("leaving right after typing saves the last edit for another device", async ({ browser }) => {
    const day = await createWrittenExamDay();
    const page = await openAs(browser, day.user);

    try {
      const field = await openEditor(page);
      await field.fill("Final paragraph");
      await page.getByRole("link", { exact: true, name: "Leave" }).click();
      await expect(page).toHaveURL(/\/today/u);
      expect(await savedDraftText(day.blockId)).toBe("Final paragraph");

      const other = await openAs(browser, day.user);

      try {
        await other.goto(`/essay/${day.blockId}`);
        await other.getByRole("button", { exact: true, name: "Continue" }).click();
        await expect(other.getByLabel("Your answer")).toHaveValue("Final paragraph");
      } finally {
        await other.context().close();
      }
    } finally {
      await page.context().close();
    }
  });

  test("closing the tab right after typing saves the last edit", async ({ browser }) => {
    const day = await createWrittenExamDay();
    const page = await openAs(browser, day.user);
    const context = page.context();

    try {
      const field = await openEditor(page);
      await field.fill("Typed just before closing the tab");
      await page.close({ runBeforeUnload: true });

      await expect
        .poll(() => savedDraftText(day.blockId))
        .toBe("Typed just before closing the tab");
    } finally {
      await context.close();
    }
  });

  test("offline, leaving asks first, and the text is saved when the connection is back with no new keystroke", async ({
    browser,
  }) => {
    const day = await createWrittenExamDay();
    const page = await openAs(browser, day.user);
    const notSaved = page.getByText("Not saved yet. It's kept on this device.");

    try {
      await page.goto("/today");
      await page.getByRole("button", { name: "Start" }).click();
      const write = page.getByRole("button", { exact: true, name: "Write" });
      await expect(write).toBeEnabled();

      // The connection can drop before any script requested on opening the editor arrives.
      await page.route("**/_next/static/**/*.js", (route) => route.abort());
      await write.click();
      const field = page.getByLabel("Your answer");
      await expect(field).toBeVisible();
      await page.context().setOffline(true);
      await field.fill("Typed on the train");
      await expect(notSaved).toBeVisible();

      // Leaving still asks first, though the connection is gone.
      await page.getByRole("link", { exact: true, name: "Leave" }).click();

      await page
        .getByRole("alertdialog", { name: "Your answer isn't saved yet" })
        .getByRole("button", { name: "Keep writing" })
        .click();

      await page.context().setOffline(false);
      await expect.poll(() => savedDraftText(day.blockId)).toBe("Typed on the train");
      await expect(notSaved).toBeHidden();
    } finally {
      await page.context().close();
    }
  });

  test("a grade replayed for the text sent first says so, and keeps the edits made since", async ({
    browser,
  }) => {
    const day = await createWrittenExamDay();
    const page = await openAs(browser, day.user);

    try {
      const field = await openEditor(page);
      await field.fill("The version sent first");
      let sends = 0;

      // The first send's answer is lost. Grading it for real costs a model call, so the second
      // send gets what the server replays for an admission it already graded: the first text's.
      await page.route("**/submissions", async (route) => {
        sends += 1;

        if (sends === 1) {
          await route.abort();
          return;
        }

        await route.fulfill({
          json: {
            attemptId: crypto.randomUUID(),
            grade: POINTS_GRADE,
            submittedAt: new Date().toISOString(),
            text: "The version sent first",
          },
        });
      });

      await page.getByRole("button", { name: "Grade answer" }).click();
      await expect(page.getByText(/That didn't go through/u)).toBeVisible();

      await field.fill("The version sent first, then edited");
      await page.getByRole("button", { name: "Grade answer" }).click();

      await expect(
        page.getByText(
          "This grade is for the version you sent first. Your changes are kept for your rewrite.",
        ),
      ).toBeVisible();

      const kept = await page.evaluate(
        (key) => localStorage.getItem(key),
        `writing:${day.blockId}`,
      );

      expect(kept).toContain("The version sent first, then edited");
    } finally {
      await page.context().close();
    }
  });

  test("the field takes no edits while grading, and no more than the server accepts", async ({
    browser,
  }) => {
    const day = await createWrittenExamDay();
    const page = await openAs(browser, day.user);

    try {
      const field = await openEditor(page);
      await expect(field).toHaveAttribute("maxlength", String(MAX_ESSAY_CHARACTERS));
      await field.fill("The text sent for grading");

      const { promise: held, resolve: release } = Promise.withResolvers<null>();

      await page.route("**/submissions", async (route) => {
        await held;
        await route.abort();
      });

      const sent = page.waitForRequest((request) => request.url().endsWith("/submissions"));
      await page.getByRole("button", { name: "Grade answer" }).click();
      await sent;
      await expect(field).not.toBeEditable();

      release(null);

      await expect(
        page.getByText(/That didn't go through\. Your text is still here\./u),
      ).toBeVisible();

      await expect(field).toBeEditable();
      await expect(field).toHaveValue("The text sent for grading");
    } finally {
      await page.context().close();
    }
  });

  test("a copy kept from before the limit says what to cut and isn't sent", async ({ browser }) => {
    const day = await createWrittenExamDay();
    const page = await openAs(browser, day.user);

    try {
      await openEditor(page);
      const admissionId = await admissionOf(day.blockId);

      await page.evaluate(({ key, kept }) => localStorage.setItem(key, JSON.stringify(kept)), {
        kept: { admissionId, base: 0, text: "a".repeat(MAX_ESSAY_CHARACTERS + 10) },
        key: `writing:${day.blockId}`,
      });

      await page.reload();
      await page.getByRole("button", { exact: true, name: "Continue" }).click();

      await expect(
        page.getByText("This answer is 10 characters too long. Shorten it to save and grade it."),
      ).toBeVisible();

      await expect(page.getByRole("button", { name: "Grade answer" })).toBeDisabled();
    } finally {
      await page.context().close();
    }
  });
});

test.describe("A written question's start", () => {
  test("an address never shows a refusal: an unknown block is not found, and the learner's own shows its task", async ({
    browser,
  }) => {
    const day = await createWrittenExamDay();
    const page = await openAs(browser, day.user);

    try {
      await page.goto(`/essay/${crypto.randomUUID()}?writing=limit&task=Invented`);
      await expect(page.getByText("No more grading today")).toHaveCount(0);
      await expect(page.getByText("Invented")).toHaveCount(0);

      await page.goto(`/essay/${day.blockId}?writing=limit&task=Invented`);
      await expect(page.getByRole("heading", { name: "Write the 30-line question" })).toBeVisible();
      await expect(page.getByText("No more grading today")).toHaveCount(0);
      expect(await prisma.writingAdmission.count({ where: { userId: day.user.id } })).toBe(0);
    } finally {
      await page.context().close();
    }
  });

  test("a guest who needs an account to write the question is asked to create one", async ({
    browser,
  }) => {
    const day = await createWrittenExamDay({ prompts: false });
    const page = await openAs(browser, day.user);

    try {
      await page.route("**/starts", (route) =>
        route.fulfill({
          json: { error: { code: "SIGN_UP_REQUIRED", message: "Create an account" } },
          status: 403,
        }),
      );

      await page.goto("/today");
      await page.getByRole("button", { name: "Start" }).click();

      await expect(page.getByText("This needs a free account")).toBeVisible();
      await expect(page.getByRole("link", { name: "Create a free account" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);
    } finally {
      await page.context().close();
    }
  });
});
