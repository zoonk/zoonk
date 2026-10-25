import { randomUUID } from "node:crypto";
import { ONBOARDING_QUESTIONS } from "@zoonk/core/view-models/onboarding/contract";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";
import { isJsonObject } from "@zoonk/utils/json";
import { type Page, expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";
import { REPLAN_TIMEOUT_MS } from "./plan-timeouts";
import { openAs } from "./study-day";

/**
 * An exam whose candidates take one of several subjects (ENEM's foreign language: English or
 * Spanish) asks which one when the goal starts, and the learner can change it in "Adjust your
 * plan". The exam then shows the option they take, never the other, and the plan studies it.
 */

const LANGUAGES = "Linguagens";
const FOREIGN = "Língua Estrangeira";
const ENGLISH = "Língua Inglesa";
const SPANISH = "Língua Espanhola";

/** Every onboarding screen before the plan, so the goal has its Plan. */
const ALL_ANSWERED = [...ONBOARDING_QUESTIONS, "buddy", "placement"];

async function loadPicks(goalId: string): Promise<unknown> {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId } });
  return isJsonObject(plan.settings) ? (plan.settings.examChoices ?? []) : null;
}

async function openEditor(page: Page) {
  await page.goto("/plan");
  await expect(page.getByRole("heading", { level: 1, name: "Plan" })).toBeVisible();
  await page.getByRole("button", { name: "Adjust plan" }).click();
  return page.getByRole("dialog", { name: "Adjust your plan" });
}

/** An ENEM-like notice: 45 language questions, 5 of them in English or Spanish, as picked. */
function choiceBlueprintFixture() {
  const citation = { passage: "Língua Estrangeira (Inglês ou Espanhol)", sourceId: "notice" };

  const option = { choiceGroup: FOREIGN, citation, partOf: LANGUAGES, questions: 5, weight: null };

  return examBlueprintFixture({
    language: "pt",
    name: "ENEM",
    structure: {
      formats: [
        { citation, description: "Cinco alternativas", kind: "multipleChoice", options: 5 },
      ],
      mock: null,
      rules: [],
      subjects: [
        { citation, name: LANGUAGES, questions: 45, topics: ["Leitura"], weight: null },
        { ...option, name: ENGLISH, shortName: "Inglês", topics: ["Reading"] },
        { ...option, name: SPANISH, shortName: "Espanhol", topics: ["Lectura"] },
      ],
    },
  });
}

/** A new goal for an exam with English or Spanish, past the questions before the choice. */
async function createChoiceGoal(userId: string) {
  const blueprint = await choiceBlueprintFixture();

  const goal = await goalFixture({
    details: { answered: ["target"], examName: "ENEM" },
    examBlueprintId: blueprint.id,
    kind: "exam",
    title: "Passar no ENEM",
    userId,
  });

  await planFixture({ goalId: goal.id, phases: [] });
  return goal;
}

/** A skill of the notice's subject with one Library lesson in the chapter. */
async function createTaughtSkill({
  area,
  chapterId,
  position,
  topic,
}: {
  area: string;
  chapterId: string;
  position: number;
  topic: string;
}) {
  const [skill, lesson] = await Promise.all([
    skillFixture({ name: `${topic} ${randomUUID()}` }),
    libraryLessonFixture({
      estimatedMinutes: 3,
      homeChapterId: chapterId,
      title: `${topic} ${randomUUID()}`,
    }),
  ]);

  await Promise.all([
    chapterLessonFixture({ chapterId, lessonId: lesson.id, position }),
    lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
  ]);

  return { area, lessons: 1, name: skill.name, phase: 0, skillId: skill.id, topics: [topic] };
}

/**
 * A learner past onboarding whose exam graph teaches both languages, as a graph written for the
 * exam does, with a lesson for each. The plan studies neither until they pick one.
 */
async function createLanguageLearner() {
  const user = await createE2EUser(getBaseURL());

  const [blueprint, chapter] = await Promise.all([
    choiceBlueprintFixture(),
    libraryChapterFixture({ title: "Leitura" }),
  ]);

  const skills = await Promise.all(
    [
      { area: LANGUAGES, topic: "Leitura" },
      { area: LANGUAGES, topic: "Leitura" },
      { area: ENGLISH, topic: "Reading" },
      { area: SPANISH, topic: "Lectura" },
    ].map((skill, position) => createTaughtSkill({ ...skill, chapterId: chapter.id, position })),
  );

  const goal = await goalFixture({
    dailyMinutes: 30,
    details: { answered: ALL_ANSWERED, examName: "ENEM", placementDeclined: true },
    examBlueprintId: blueprint.id,
    kind: "exam",
    targetDate: new Date(toUTCMidnight(new Date()).getTime() + 60 * MS_PER_DAY),
    timezone: "UTC",
    title: "Passar no ENEM",
    userId: user.id,
  });

  // A plan already laid out once, so the Plan opens.
  const plan = await planFixture({
    goalId: goal.id,
    graph: { phases: [{ milestone: null, name: LANGUAGES }], skills },
  });

  // Placement settled the first skill.
  await Promise.all([
    planItemFixture({
      completedAt: new Date(),
      kind: "lesson",
      planId: plan.id,
      position: 0,
      skillId: skills[0]?.skillId ?? null,
      status: "testedOut",
      titleSnapshot: "Leitura",
    }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
  ]);

  const areaOf = new Map(skills.map((skill) => [skill.skillId, skill.area]));
  return { areaOf, goal, user };
}

/** The subjects of the lessons the plan has to do. */
async function loadPlannedAreas({
  areaOf,
  goalId,
}: {
  areaOf: ReadonlyMap<string, string>;
  goalId: string;
}): Promise<string[]> {
  const items = await prisma.planItem.findMany({
    select: { skillId: true },
    where: { kind: "lesson", plan: { goalId }, status: "todo" },
  });

  return [...new Set(items.flatMap((item) => areaOf.get(item.skillId ?? "") ?? []))].toSorted();
}

test.describe("Exam choices", () => {
  test("a new exam goal asks which option the learner takes, and keeps it for the plan", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const goal = await createChoiceGoal(noProgressUser.id);

    await page.goto(`/start/${goal.id}`);

    const question = page.getByRole("heading", { name: "Which one will you take?" });
    await expect(question).toBeVisible();
    await expectAccessibleScreen(page, "Which one will you take?");

    const options = page.getByRole("radiogroup", { name: FOREIGN });
    await expect(options.getByRole("radio")).toHaveCount(2);

    const next = page.getByRole("button", { exact: true, name: "Continue" });
    await expect(next).toBeDisabled();

    await options.getByRole("radio", { name: /Espanhol/u }).click();
    await next.click();

    await expect(question).toBeHidden();

    await expect
      .poll(() => loadPicks(goal.id))
      .toStrictEqual([{ group: FOREIGN, subject: SPANISH }]);

    const level = page.getByRole("heading", { name: "Which subjects do you already know well?" });
    await expect(level).toBeVisible();
    await expect(page.getByRole("img", { name: /^Step 3 of \d+$/u })).toBeVisible();

    await page.reload();
    await expect(level).toBeVisible();
    await expect(page.getByRole("img", { name: /^Step 3 of \d+$/u })).toBeVisible();
    await page.getByRole("button", { exact: true, name: "Back" }).click();
    await expect(question).toBeVisible();
    await expect(options.getByRole("radio", { name: /Espanhol/u })).toBeChecked();
  });

  test("number keys pick on the screen that follows an answer, while that answer finishes saving", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const goal = await createChoiceGoal(noProgressUser.id);

    // The target question comes first: the choice screen shows as soon as its answer is saved.
    await prisma.goal.update({
      data: { details: { examName: "ENEM", examTarget: "admission" } },
      where: { id: goal.id },
    });

    await page.goto(`/start/${goal.id}`);

    await expect(
      page.getByRole("heading", { name: "Which course and score are you aiming for?" }),
    ).toBeVisible();

    await page.getByRole("button", { exact: true, name: "Skip" }).click();
    await expect(page.getByRole("heading", { name: "Which one will you take?" })).toBeVisible();

    // An ENEM learner pressed 1 for English right away, and nothing was picked.
    await page.keyboard.press("1");

    await expect
      .poll(() => loadPicks(goal.id))
      .toStrictEqual([{ group: FOREIGN, subject: ENGLISH }]);
  });

  test("going back while an answer is still saving waits for it, instead of taking a pick that can't save", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const goal = await createChoiceGoal(noProgressUser.id);

    await prisma.goal.update({
      data: { details: { examName: "ENEM", examTarget: "admission" } },
      where: { id: goal.id },
    });

    await page.goto(`/start/${goal.id}`);
    await page.getByRole("button", { exact: true, name: "Skip" }).click();
    await expect(page.getByRole("heading", { name: "Which one will you take?" })).toBeVisible();

    // The language's answer is held on its way to the server.
    const held: (() => void)[] = [];

    await page.route(`**/start/${goal.id}`, async (route) => {
      if (route.request().method() === "POST" && route.request().headers()["next-action"]) {
        await new Promise<void>((release) => {
          held.push(release);
        });
      }

      await route.fallback();
    });

    await page.keyboard.press("2");
    await expect.poll(() => held.length).toBe(1);

    // Back while it saves: the screen there waits too, so nothing picked on it is lost.
    await page.getByRole("button", { exact: true, name: "Back" }).click();

    await expect(
      page.getByRole("heading", { name: "Which course and score are you aiming for?" }),
    ).toBeVisible();

    await expect(page.getByRole("button", { exact: true, name: "Skip" })).toBeDisabled();

    held.forEach((release) => release());

    await expect
      .poll(() => loadPicks(goal.id))
      .toStrictEqual([{ group: FOREIGN, subject: SPANISH }]);
  });

  test("an ENEM learner who takes English switches to Spanish in the plan, and the exam shows Spanish, not English", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      const editor = await openEditor(page);
      const choice = editor.getByRole("group", { name: FOREIGN });

      // Ana picked English when she started.
      await expect(choice.getByRole("radio", { name: "Inglês" })).toBeChecked();
      await expect(choice.getByRole("radio", { name: "Espanhol" })).not.toBeChecked();

      // The pick shows at once while the plan is made again, which can take a while: the save
      // waits here until the editor has shown it.
      const saving = Promise.withResolvers<boolean>();

      await page.route(
        (url) => url.pathname === "/plan",
        async (route) => {
          if (route.request().postData()?.includes(SPANISH)) {
            await saving.promise;
          }

          await route.fallback();
        },
      );

      await choice.getByRole("radio", { name: "Espanhol" }).click();

      await expect(choice.getByRole("radio", { name: "Espanhol" })).toBeChecked();
      await expect(choice.getByRole("radio", { name: "Inglês" })).not.toBeChecked();
      saving.resolve(true);

      // The editor confirms the pick in words, with a way back, once the plan is made again.
      await expect(
        editor
          .getByRole("status")
          .filter({ hasText: `Your plan studies ${SPANISH} for ${FOREIGN}.` }),
      ).toBeVisible({ timeout: REPLAN_TIMEOUT_MS });

      await expect(editor.getByRole("button", { exact: true, name: "Undo" })).toBeVisible();

      await expect
        .poll(() => loadPicks(user.goalId))
        .toStrictEqual([{ group: FOREIGN, subject: SPANISH }]);

      await page.keyboard.press("Escape");
      await expect(editor).toBeHidden();

      // The subjects: the languages area the notice counts her language in, never the language as
      // a subject of its own, and never as an area beyond the notice.
      const syllabus = page.getByRole("region", { exact: true, name: "Subjects" });
      const languages = syllabus.getByRole("link", { name: /Linguagens/u });

      await expect(languages).toHaveCount(1);
      await expect(languages).toContainText("Códigos");
      await expect(languages).not.toContainText("Not in your plan");

      await expect(
        syllabus.getByRole("link", { name: /Espanhol|Inglês|Língua Espanhola|Língua Inglesa/u }),
      ).toHaveCount(0);

      // Its page lists the language she takes among its topics, never the other.
      await languages.click();
      await expect(page.getByText(SPANISH, { exact: true })).toBeVisible();
      await expect(page.getByText(ENGLISH, { exact: true })).toHaveCount(0);
    });
  });

  test("a learner who decided later is asked on the Plan, and the pick says what it did", async ({
    browser,
  }) => {
    const { areaOf, goal, user } = await createLanguageLearner();
    const page = await openAs(browser, user);
    await page.goto("/plan");

    // The plan studies no foreign language until she picks: the Plan's one suggestion asks, not
    // only the editor. It asks first, before saying that the rest of her plan is done: a plan that
    // leaves a subject out isn't finished yet.
    const question = page.getByRole("region", { name: `${FOREIGN}: which one will you take?` });
    const spanish = question.getByRole("button", { exact: true, name: "Espanhol" });

    await expect(question).toContainText(`Until you pick, your plan leaves ${FOREIGN} out.`);
    await spanish.click();

    // The pick says what it did where the options were, with a way back.
    await expect(
      question
        .getByRole("status")
        .filter({ hasText: `Your plan studies ${SPANISH} for ${FOREIGN}.` }),
    ).toBeVisible();

    await expect(spanish).toHaveCount(0);

    await expect
      .poll(() => loadPlannedAreas({ areaOf, goalId: goal.id }))
      .toStrictEqual([SPANISH, LANGUAGES].toSorted());

    // Undo asks again right away: the plan is back as it was, the question with it.
    await question.getByRole("button", { exact: true, name: "Undo" }).click();
    await expect.poll(() => loadPicks(goal.id)).toStrictEqual([]);
    await expect(spanish).toBeVisible({ timeout: 15_000 });
    await expect(question).toBeFocused();

    await spanish.click();

    await expect
      .poll(() => loadPicks(goal.id))
      .toStrictEqual([{ group: FOREIGN, subject: SPANISH }]);

    await page.context().close();
  });

  test("a learner who decided later is asked on Today, and the pick says what it did", async ({
    browser,
  }) => {
    const { areaOf, goal, user } = await createLanguageLearner();
    const page = await openAs(browser, user);
    await page.goto("/today");

    // Today is where she studies: "Decide later" in onboarding left the language out of her plan.
    const question = page
      .locator('[data-slot="exam-choice-notice"]')
      .filter({ hasText: `${FOREIGN}: which one will you take?` });

    await expect(question).toContainText(`Until you pick, your plan leaves ${FOREIGN} out.`);
    await question.getByRole("button", { exact: true, name: "Espanhol" }).click();

    await expect(
      page.getByRole("status").filter({ hasText: `Your plan studies ${SPANISH} for ${FOREIGN}.` }),
    ).toBeVisible();

    await expect(question).toBeHidden();

    await expect
      .poll(() => loadPlannedAreas({ areaOf, goalId: goal.id }))
      .toStrictEqual([SPANISH, LANGUAGES].toSorted());

    // Undo asks again.
    await page.getByRole("button", { exact: true, name: "Undo" }).click();
    await expect(question).toBeVisible();
    await expect.poll(() => loadPicks(goal.id)).toStrictEqual([]);

    await page.context().close();
  });

  test("the plan studies the language the learner picks, and swaps it when they change it", async ({
    browser,
  }) => {
    const { areaOf, goal, user } = await createLanguageLearner();
    const page = await openAs(browser, user);

    const editor = await openEditor(page);
    const choice = editor.getByRole("group", { name: FOREIGN });

    // Until she picks, the plan studies neither, and says so.
    await expect(choice.getByRole("radio", { name: "Inglês" })).not.toBeChecked();
    await expect(choice.getByRole("radio", { name: "Espanhol" })).not.toBeChecked();

    await expect(
      choice.getByText(`Pick the one you'll take. Until you do, your plan leaves ${FOREIGN} out.`),
    ).toBeVisible();

    // Picking re-plans: the reading lessons and Spanish's.
    await choice.getByRole("radio", { name: "Espanhol" }).click();
    await expect(choice.getByRole("radio", { name: "Espanhol" })).toBeChecked();
    await expect(choice.getByText(/Until you do/u)).toBeHidden();

    await expect
      .poll(() => loadPlannedAreas({ areaOf, goalId: goal.id }))
      .toStrictEqual([SPANISH, LANGUAGES].toSorted());

    // The subjects list no language apart, and the languages area counts Spanish's topic.
    await page.keyboard.press("Escape");
    const syllabus = page.getByRole("region", { exact: true, name: "Subjects" });

    await expect(
      syllabus.getByRole("link", { name: /Espanhol|Inglês|Língua Espanhola|Língua Inglesa/u }),
    ).toHaveCount(0);

    await syllabus.getByRole("link", { name: /^Linguagens/u }).click();

    await expect(page.getByRole("region", { name: "Topics in the notice" })).toContainText(
      "0 of 2 topics",
    );

    // Changing her mind swaps the languages' lessons.
    const again = await openEditor(page);

    await again
      .getByRole("group", { name: FOREIGN })
      .getByRole("radio", { name: "Inglês" })
      .click();

    await expect
      .poll(() => loadPlannedAreas({ areaOf, goalId: goal.id }))
      .toStrictEqual([ENGLISH, LANGUAGES].toSorted());

    await page.context().close();
  });
});
