import { readFile } from "node:fs/promises";
import { prisma } from "@zoonk/db";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { memoryFactFixture } from "@zoonk/testing/fixtures/memory";
import { type Page, expect, test } from "./fixtures";

/**
 * The Memory screen: everything Zoonk remembers grouped by category, correcting and deleting
 * (with undo) a fact, turning memory off, downloading it, and what minors see.
 */

const TEEN_BIRTH_YEAR = new Date().getUTCFullYear() - 15;

/** Without an age answer, memory keeps only goals and learning facts, like a minor's. */
const ADULT_BIRTH = { birthMonth: 1, birthYear: 1990 };

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
      learningProfileFixture({
        ...ADULT_BIRTH,
        experienceMode: "focus",
        userId: noProgressUser.id,
      }),
    ]);

    await openMemory(page);

    const goals = page.getByRole("region", { name: "Goals" });
    await expect(goals.getByText("Wants Law at a public university")).toBeVisible();
    await expect(goals.getByText(/From a chat/u)).toBeVisible();

    await expect(page.getByRole("region", { name: "Routine" }).getByText(/Noticed/u)).toBeVisible();

    await expect(page.getByRole("region", { name: "Background" })).toBeVisible();

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

  test("turns memory off and downloads it", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    await Promise.all([
      createFacts(noProgressUser.id),
      learningProfileFixture({ ...ADULT_BIRTH, experienceMode: "fun", userId: noProgressUser.id }),
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

test.describe("Memory for minors", () => {
  test("only shows the categories a minor's memory may hold", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    await Promise.all([
      createFacts(noProgressUser.id),
      learningProfileFixture({
        birthMonth: 1,
        birthYear: TEEN_BIRTH_YEAR,
        userId: noProgressUser.id,
      }),
    ]);

    await openMemory(page);

    await expect(page.getByRole("region", { name: "Goals" })).toBeVisible();
    await expect(page.getByText("Works at a bakery")).toBeHidden();
    await expect(page.getByRole("region", { name: "Background" })).toBeHidden();
  });
});
