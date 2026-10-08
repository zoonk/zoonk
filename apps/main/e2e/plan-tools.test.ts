import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { buildLessonIdentityKey, buildSetupSkillIdentityKey } from "@zoonk/utils/identity-key";
import { type Page, expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";

/**
 * The "You'll use" card in the plan editor. Maya's quantum physics plan (the v2 seed) has a vectors
 * chapter that needs a graphing calculator and a quantum computing chapter where Python helps.
 * Setting a tool up adds its setup lesson before the chapter; another answer takes it out.
 */

const CALCULATOR = "Graphing calculator (Desmos or GeoGebra)";
const PYTHON = "Python";

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

  return { lesson, skill };
}

/**
 * The plan's lessons for the setup skill. Earlier runs may have written another lesson for it, so
 * this counts by the skill, whichever of its lessons the planner picked.
 */
function countSetupItems({ goalId, skillId }: { goalId: string; skillId: string }) {
  return prisma.planItem.count({ where: { kind: "lesson", plan: { goalId }, skillId } });
}

function toolsCard(page: Page) {
  return page
    .getByRole("dialog", { name: "Adjust your plan" })
    .getByRole("region", { name: "You'll use" });
}

/** Tools live in the plan's editor, which the Journey's "Adjust plan" opens. */
async function openPlanEditor(page: Page) {
  await page.goto("/journey");
  await page.getByRole("button", { name: "Adjust plan" }).click();
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
  test("the learner has one tool, sets the other up, then goes without it", async ({ browser }) => {
    const device = { label: "Windows", system: "windows" };
    const setup = await ensureSetupLesson({ system: device.system, tool: PYTHON });

    await asPersona(browser, { persona: "hugeGoal" }, async ({ page, user }) => {
      await openPlanEditor(page);

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

      await expect
        .poll(() => countSetupItems({ goalId: user.goalId, skillId: setup.skill.id }))
        .toBe(1);

      // Choosing again takes the setup lesson back out.
      await chooseTool(page, { answer: /^No install/u, tool: PYTHON });
      await expect(card.getByText("Examples only")).toBeVisible();

      await expect
        .poll(() => countSetupItems({ goalId: user.goalId, skillId: setup.skill.id }))
        .toBe(0);
    });
  });
});

/** Every onboarding question is behind the learner, so `/start/{goalId}` opens on the plan. */
const ANSWERED = [
  "purpose",
  "targetDate",
  "level",
  "schedule",
  "age",
  "memory",
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
  test("the plan reveal leaves tools for the plan editor", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const { goal } = await createRevealGoal(noProgressUser.id);

    await page.goto(`/start/${goal.id}`);

    await expect(page.getByRole("heading", { level: 1, name: "Your plan is ready" })).toBeVisible();
    await expect(page.getByRole("region", { name: "You'll use" })).toHaveCount(0);
  });
});
