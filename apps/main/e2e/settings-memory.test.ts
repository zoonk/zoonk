import { readFile } from "node:fs/promises";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import {
  guardianLinkFixture,
  learningProfileFixture,
} from "@zoonk/testing/fixtures/learning-profiles";
import { memoryFactFixture } from "@zoonk/testing/fixtures/memory";
import { type Page, expect, test } from "./fixtures";

/**
 * The Memory screen: everything Zoonk remembers grouped by category, correcting and deleting
 * (with undo) a fact, turning memory off and downloading it.
 */

/** Without an age answer, memory starts off and keeps only goals and learning, like a minor's. */
const ADULT_BIRTH = { birthMonth: 1, birthYear: 1990 };
const TEEN_BIRTH = { birthMonth: 1, birthYear: new Date().getUTCFullYear() - 15 };

async function createFacts(userId: string) {
  const [goal, routine] = await Promise.all([
    memoryFactFixture({
      category: "goals",
      sourceRef: { id: null, kind: "chat" },
      statement: "Wants Law at a public university",
      userId,
    }),
    memoryFactFixture({
      category: "routine",
      origin: "noticed",
      statement: "Studies after 8 pm on weekdays",
      userId,
    }),
    memoryFactFixture({ category: "background", statement: "Works at a bakery", userId }),
  ]);

  return { goal, routine };
}

async function openMemory(page: Page) {
  await page.goto("/settings/memory");
  await expect(page.getByRole("heading", { level: 1, name: "Memory" })).toBeVisible();
}

function factOptions(page: Page, statement: string) {
  return page.getByRole("button", { name: `Options for “${statement}”` });
}

test.describe("Memory", () => {
  test("lists facts by category, corrects one and deletes another with undo", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const [{ goal, routine }] = await Promise.all([
      createFacts(noProgressUser.id),
      learningProfileFixture({ ...ADULT_BIRTH, userId: noProgressUser.id }),
    ]);

    await openMemory(page);

    const goals = page.getByRole("region", { name: "Goals" });
    await expect(goals.getByText("Wants Law at a public university")).toBeVisible();
    await expect(goals.getByText(/From a chat/u)).toBeVisible();

    await expect(page.getByRole("region", { name: "Routine" }).getByText(/Noticed/u)).toBeVisible();

    await expect(page.getByRole("region", { name: "Background" })).toBeVisible();
    await expectAccessibleScreen(page, "the memory settings");

    await factOptions(page, "Wants Law at a public university").click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    const editor = page.getByRole("dialog", { name: "Edit memory" });
    await editor.getByRole("textbox").fill("Wants Law at USP");
    await editor.getByRole("button", { name: "Save" }).click();
    await expect(goals.getByText("Wants Law at USP")).toBeVisible();

    await expect
      .poll(() => prisma.memoryFact.findUnique({ where: { id: goal.id } }))
      .toMatchObject({ statement: "Wants Law at USP" });

    await factOptions(page, "Studies after 8 pm on weekdays").click();
    await page.getByRole("menuitem", { name: "Delete" }).click();

    await expect(
      page.getByRole("main").getByText("Studies after 8 pm on weekdays", { exact: true }),
    ).toBeHidden();

    const notice = page.getByRole("status").filter({ hasText: "Memory updated:" });
    await expect(notice).toBeVisible();

    await expect
      .poll(() => prisma.memoryFact.findUnique({ where: { id: routine.id } }))
      .toMatchObject({ status: "deleted" });

    await notice.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByText("Change undone")).toBeVisible();
    await expect(page.getByRole("region", { name: "Routine" })).toBeVisible();

    await expect
      .poll(() => prisma.memoryFact.findUnique({ where: { id: routine.id } }))
      .toMatchObject({ status: "active" });
  });

  test("keeps a teen's memory off until they turn it on, and only for goals and learning", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    await Promise.all([
      createFacts(noProgressUser.id),
      learningProfileFixture({ ...TEEN_BIRTH, userId: noProgressUser.id }),
    ]);

    await openMemory(page);

    // Off by default, with what turning it on means said right there.
    const memorySwitch = page.getByRole("switch", { name: "Use memory" });
    await expect(memorySwitch).not.toBeChecked();
    await expect(memorySwitch).toHaveAccessibleDescription(/Turn it on and Zoonk remembers/u);
    await expect(page.getByText(/Ask a parent or guardian/u)).toBeVisible();

    await expect(
      page.getByText(/never health, religion or other sensitive details/u),
    ).toBeVisible();

    // A minor's memory holds only goals and learning, so the routine and background facts don't show.
    await expect(page.getByRole("region", { name: "Goals" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Routine" })).toBeHidden();
    await expect(page.getByRole("region", { name: "Background" })).toBeHidden();

    await memorySwitch.click();
    await expect(memorySwitch).toBeChecked();

    await expect(
      page.getByText("Examples and answers that fit your goals and how you learn"),
    ).toBeVisible();

    await expect
      .poll(async () =>
        prisma.userLearningProfile.findUnique({ where: { userId: noProgressUser.id } }),
      )
      .toMatchObject({ memoryEnabled: true });
  });

  test("says a guardian turned a teen's memory off, and keeps it off", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    await Promise.all([
      createFacts(noProgressUser.id),
      learningProfileFixture({ ...TEEN_BIRTH, memoryEnabled: true, userId: noProgressUser.id }),
      guardianLinkFixture({
        acceptedAt: new Date(),
        memoryOff: true,
        status: "active",
        userId: noProgressUser.id,
      }),
    ]);

    await openMemory(page);

    const memorySwitch = page.getByRole("switch", { name: "Use memory" });
    await expect(memorySwitch).not.toBeChecked();
    await expect(memorySwitch).toBeDisabled();
    await expect(memorySwitch).toHaveAccessibleDescription("Your guardian turned memory off.");

    // Their facts stay listed for them to see, correct or delete.
    await expect(page.getByText("Wants Law at a public university")).toBeVisible();
  });

  test("turns memory off and downloads it", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    await Promise.all([
      createFacts(noProgressUser.id),
      learningProfileFixture({ ...ADULT_BIRTH, userId: noProgressUser.id }),
    ]);

    await openMemory(page);

    const memorySwitch = page.getByRole("switch", { name: "Use memory" });
    await expect(memorySwitch).toBeChecked();
    await memorySwitch.click();
    await expect(memorySwitch).not.toBeChecked();
    await expect(page.getByText(/Memory is off/u)).toBeVisible();

    await expect
      .poll(async () =>
        prisma.userLearningProfile.findUnique({ where: { userId: noProgressUser.id } }),
      )
      .toMatchObject({ memoryEnabled: false });

    // The facts stay listed so they can still be edited, deleted or downloaded.
    await expect(page.getByText("Wants Law at a public university")).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download my memory" }).click(),
    ]);

    expect(download.suggestedFilename()).toBe("zoonk-memory.json");
    const exported: unknown = JSON.parse(await readFile((await download.path())!, "utf8"));

    expect(exported).toMatchObject({
      enabled: false,
      facts: expect.arrayContaining([
        expect.objectContaining({ statement: "Wants Law at a public university" }),
      ]),
    });
  });
});
