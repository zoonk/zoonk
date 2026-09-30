import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { buildLessonIdentityKey, buildSetupSkillIdentityKey } from "@zoonk/utils/identity-key";
import { type Page, expect, test } from "./fixtures";
import { MODES, type Mode, asPersona, setDeviceMode } from "./learn-personas";

/**
 * The "You'll use" card. Maya's quantum physics plan (the v2 seed) has a vectors chapter that
 * needs a graphing calculator and a quantum computing chapter where Python helps. Each answer is
 * a plan change with an undo; setting a tool up adds its setup lesson before the chapter.
 */

const CALCULATOR = "Graphing calculator (Desmos or GeoGebra)";
const PYTHON = "Python";

/** Each mode sets Python up on its own device, so parallel tests never write the same lesson. */
const DEVICES = {
  focus: { label: "Windows", system: "windows" },
  fun: { label: "macOS", system: "macos" },
} as const;

/**
 * The setup lesson an earlier learner's choice wrote, keyed like core keys it. Tests never call
 * the model, so the lesson exists before the learner picks the device.
 */
async function ensureSetupLesson({ system, tool }: { system: string; tool: string }) {
  const title = `Set up ${tool} on ${system}`;
  const identityKey = buildSetupSkillIdentityKey({ system, tool });
  const provenance = { model: "test/e2e", promptVersion: "e2e", runId: `e2e-${randomUUID()}` };

  const skill = await prisma.skill.upsert({
    create: {
      description: `Get ${tool} ready on ${system}.`,
      identityKey,
      language: "en",
      level: "beginner",
      name: title,
      normalizedName: title.toLowerCase(),
      ...provenance,
    },
    update: {},
    where: { languageIdentity: { identityKey, language: "en" } },
  });

  const lessonKey = buildLessonIdentityKey({
    courseId: null,
    level: "beginner",
    skillIds: [skill.id],
    targetLanguage: null,
  });

  const lesson = await prisma.lesson.upsert({
    create: {
      description: `Install ${tool} and check that it works.`,
      estimatedMinutes: 4,
      identityKey: lessonKey,
      language: "en",
      level: "beginner",
      normalizedTitle: title.toLowerCase(),
      slug: `setup-${system}-${randomUUID()}`,
      title,
      ...provenance,
    },
    update: {},
    where: { languageIdentity: { identityKey: lessonKey, language: "en" } },
  });

  await prisma.lessonSkill.upsert({
    create: { lessonId: lesson.id, skillId: skill.id },
    update: {},
    where: { lessonId_skillId: { lessonId: lesson.id, skillId: skill.id } },
  });

  return lesson;
}

function toolsCard(page: Page) {
  return page.getByRole("region", { name: "You'll use" });
}

/** Maya's plan has no date, so Focus titles it "Your plan"; Fun always calls it the Route. */
async function openPlan(page: Page, mode: Mode) {
  await page.goto("/plan");

  await expect(
    page.getByRole("heading", { level: 1, name: mode === "fun" ? "Route" : "Your plan" }),
  ).toBeVisible();
}

/** Tools only later phases use wait under "More later" until the learner opens it. */
async function openLaterTools(page: Page) {
  const later = toolsCard(page).getByText(/^More later: /u);

  if (await later.isVisible()) {
    await later.click();
  }
}

async function chooseTool(
  page: Page,
  { answer, device, tool }: { answer: RegExp; device?: string; tool: string },
) {
  const button = toolsCard(page).getByRole("button", { name: `how you'll use ${tool}` });

  if (!(await button.isVisible())) {
    await openLaterTools(page);
  }

  await button.click();

  const sheet = page.getByRole("dialog", { name: tool });
  await sheet.getByRole("radio", { name: answer }).click();

  if (device) {
    await sheet.getByRole("button", { exact: true, name: device }).click();
  }

  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(sheet).toBeHidden();
}

async function loadToolChoices(goalId: string) {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId } });
  return plan.settings;
}

test.describe("Plan tools", () => {
  for (const mode of MODES) {
    test(`the learner has one tool and sets the other up, with an undo, in ${mode}`, async ({
      browser,
    }) => {
      const device = DEVICES[mode];
      const setup = await ensureSetupLesson({ system: device.system, tool: PYTHON });

      await asPersona(browser, { mode, persona: "hugeGoal" }, async ({ page, user }) => {
        await openPlan(page, mode);

        const card = toolsCard(page);
        await expect(card.getByText("Needed to practice")).toBeVisible();

        // Python only helps in a later phase, so it waits under "More later".
        await expect(card.getByText(`More later: ${PYTHON}`)).toBeVisible();
        await openLaterTools(page);
        await expect(card.getByText("Optional")).toBeVisible();

        await chooseTool(page, { answer: /^I have it/u, tool: CALCULATOR });
        await expect(card.getByText("You have it")).toBeVisible();

        await expect
          .poll(async () => loadToolChoices(user.goalId))
          .toMatchObject({ tools: [{ choice: "have", name: CALCULATOR }] });

        await chooseTool(page, { answer: /^I'll set it up/u, device: device.label, tool: PYTHON });
        await expect(card.getByText(`Setup lesson for ${device.label}`)).toBeVisible();

        const change = page
          .getByRole("listitem")
          .filter({
            hasText: `A lesson to set up ${PYTHON} on ${device.label} comes before you need it.`,
          });

        await expect(change).toBeVisible();

        await expect
          .poll(async () =>
            prisma.planItem.count({ where: { lessonId: setup.id, plan: { goalId: user.goalId } } }),
          )
          .toBe(1);

        await change.getByRole("button", { name: "Undo" }).click();
        await expect(change.getByText("Undone")).toBeVisible();
        await expect(card.getByText("Optional")).toBeVisible();

        await expect
          .poll(async () =>
            prisma.planItem.count({ where: { lessonId: setup.id, plan: { goalId: user.goalId } } }),
          )
          .toBe(0);
      });
    });

    test(`going without tools says what that path can't give in ${mode}`, async ({ browser }) => {
      await asPersona(browser, { mode, persona: "hugeGoal" }, async ({ page, user }) => {
        await openPlan(page, mode);

        const card = toolsCard(page);

        await card
          .getByRole("button", { name: "No tools? You can do it all with examples." })
          .click();

        const note = card.getByText("You won't practice on your own computer.", { exact: false });
        await expect(note).toBeVisible();

        // The button leaves once it's chosen, so focus moves to the note that replaces it.
        await expect(note).toBeFocused();

        await openLaterTools(page);
        await expect(card.getByText("Examples only")).toHaveCount(2);

        await expect
          .poll(async () => loadToolChoices(user.goalId))
          .toMatchObject({
            tools: [
              { choice: "none", name: CALCULATOR },
              { choice: "none", name: PYTHON },
            ],
          });
      });
    });
  }
});

/** Every onboarding question is behind the learner, so `/start/{goalId}` opens on the plan. */
const ANSWERED = [
  "purpose",
  "targetDate",
  "level",
  "schedule",
  "age",
  "mode",
  "buddy",
  "placement",
];

async function createRevealGoal(userId: string) {
  const id = randomUUID().slice(0, 8);
  const tool = `Spreadsheet ${id} (Sheets or Excel)`;

  const chapter = await libraryChapterFixture({
    title: `Reading data ${id}`,
    tools: [{ essential: true, name: tool }],
  });

  const goal = await goalFixture({
    dailyMinutes: 20,
    details: { answered: ANSWERED, level: "some", purpose: "deep" },
    prompt: `statistics for work ${id}`,
    title: `Statistics for work ${id}`,
    userId,
  });

  const plan = await planFixture({
    goalId: goal.id,
    phases: [{ kind: "learn", milestone: "Read a report", minutes: 60, name: "Basics" }],
  });

  await planItemFixture({
    chapterId: chapter.id,
    kind: "chapter",
    planId: plan.id,
    position: 0,
    titleSnapshot: chapter.title,
  });

  return { goal, tool };
}

test.describe("Plan tools on the plan reveal", () => {
  for (const mode of MODES) {
    test(`the plan reveal shows the tools card in ${mode}`, async ({
      noProgressUser,
      userWithoutProgress: page,
    }) => {
      const { goal, tool } = await createRevealGoal(noProgressUser.id);

      await setDeviceMode(page.context(), mode);
      await page.goto(`/start/${goal.id}`);

      await expect(page.getByText(mode === "fun" ? "Route ready" : "Plan ready")).toBeVisible();

      const card = toolsCard(page);
      await expect(card.getByText("Needed to practice")).toBeVisible();

      await chooseTool(page, { answer: /^No install/u, tool });
      await expect(card.getByText("Examples only")).toBeVisible();

      await expect
        .poll(async () => loadToolChoices(goal.id))
        .toMatchObject({ tools: [{ choice: "none", name: tool }] });
    });
  }
});
