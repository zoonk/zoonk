import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import {
  goalFixture,
  planChangeFixture,
  planFixture,
  planItemFixture,
} from "@zoonk/testing/fixtures/goals";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { getDateInTimeZone, getLocalTimeZone } from "@zoonk/utils/time-zone";
import { expect, test } from "./fixtures";
import { tabTo } from "./keyboard-focus";
import { ANSWERED, createMappedGoal } from "./onboarding-fixtures";

/**
 * The end of onboarding: placement while the plan is being made, then the plan. The goal is one
 * whose skill map is already written, the way the goal workflow leaves it.
 */

/** A moment this many minutes from now (before it, when negative). */
function inMinutes(minutes: number): Date {
  return new Date(Date.now() + minutes * 60_000);
}

/** Placement asks up to this many questions a day (`DAY_PLACEMENT_ANSWERS` in core). */
const DAY_PLACEMENT_ANSWERS = 12;

test.describe("Placement and the plan", () => {
  test("placement adapts to answers, survives a refresh and a new tab, welcomes 'I don't know yet' and ends with the plan, by keyboard", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const goal = await createMappedGoal(noProgressUser.id);
    await page.goto(`/start/${goal.id}`);

    await expect(
      page.getByRole("heading", { name: "Let's see what you already know" }),
    ).toBeVisible();

    await tabTo(page, page.getByRole("button", { exact: true, name: "Start" }));
    await page.keyboard.press("Enter");

    await expect(page.getByRole("heading", { name: /^Question/u })).toBeVisible();
    // What it's about and how many so far: no total and no score.
    await expect(page.getByText("Question 1", { exact: true })).toBeVisible();
    await expect(page.getByText("Algebra", { exact: true })).toBeVisible();
    await expectAccessibleScreen(page, "a placement question");
    const first = await page.getByRole("heading", { name: /^Question/u }).textContent();
    await page.keyboard.press("1");
    await expect(page.getByRole("radio", { name: /Right answer/u })).toBeChecked();
    await page.keyboard.press("Enter");

    await expect(page.getByRole("heading", { name: /^Question/u })).not.toHaveText(first ?? "");
    await expect(page.getByText("Question 2", { exact: true })).toBeVisible();

    // A refresh comes back to placement's next question instead of its start.
    await page.reload();
    await expect(page.getByText("Question 2", { exact: true })).toBeVisible();

    await expect(
      page.getByRole("heading", { name: "Let's see what you already know" }),
    ).toBeHidden();

    // So does another tab, which never saw the tap on Start: the answers are what's saved.
    const otherTab = await page.context().newPage();
    await otherTab.goto(`/start/${goal.id}`);
    await expect(otherTab.getByText("Question 2", { exact: true })).toBeVisible();
    await otherTab.close();

    await page.getByRole("button", { name: "I don't know yet" }).click();

    await expect(page.getByRole("heading", { name: /^Question/u })).toBeVisible();
    await tabTo(page, page.getByRole("button", { name: "Stop here and see my plan" }));
    await page.keyboard.press("Enter");

    // The plan's shape in two facts and its path of phases to the goal, with one way on.
    await expect(page.getByRole("heading", { level: 1, name: "Your plan is ready" })).toBeVisible();
    await expect(page.getByText("30 min a day", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Start" })).toHaveAttribute("href", "/today");

    // Two phases, then the goal itself.
    const path = page.getByRole("list", { name: "Your journey" });
    await expect(path.getByRole("listitem")).toHaveCount(3);
    await expect(path.getByRole("listitem").last()).toContainText(goal.title);
    await expect(page.locator('li[aria-current="step"]')).toContainText(", you are here");

    // No chapters, tools or numbers to read before starting, and never a skill's raw name.
    await expect(page.getByText(/~0 h/u)).toHaveCount(0);
    await expect(page.getByText("Lesson 1", { exact: true })).toHaveCount(0);
    await expect(path.getByRole("button")).toHaveCount(0);

    await expectAccessibleScreen(page, "the plan reveal");

    const [attempts, saved] = await Promise.all([
      prisma.attempt.count({ where: { itemId: { not: null }, userId: noProgressUser.id } }),
      prisma.goal.findUniqueOrThrow({ where: { id: goal.id } }),
    ]);

    expect(attempts).toBeGreaterThanOrEqual(2);
    expect(saved.details).toMatchObject({ answered: expect.arrayContaining(["placement"]) });
  });
});

test("the plan right after the learner's time shows that time, never the plan the page opened with", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const goal = await createMappedGoal(noProgressUser.id);

  // Placement and the time are left; the plan was built at the goal's first 30 minutes a day.
  await prisma.goal.update({
    data: {
      details: { answered: ANSWERED.filter((step) => step !== "schedule"), subject: "algebra" },
    },
    where: { id: goal.id },
  });

  await page.goto(`/start/${goal.id}`);
  await page.getByRole("button", { name: "Start from zero" }).click();

  await expect(
    page.getByRole("heading", { name: "How much time can you study each day?" }),
  ).toBeVisible();

  await page.getByText("1h", { exact: true }).click();

  // From here on, any moment the page says the old 30 minutes a day is remembered.
  await page.evaluate(() => {
    new MutationObserver(() => {
      if (document.body.innerText.includes("30 min a day")) {
        Object.assign(globalThis, { staleSeen: true });
      }
    }).observe(document.body, { characterData: true, childList: true, subtree: true });
  });

  await page.getByRole("button", { exact: true, name: "Continue" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Your plan is ready" })).toBeVisible();
  await expect(page.getByText("1h a day", { exact: true })).toBeVisible();

  await expect(page.evaluate(() => Reflect.get(globalThis, "staleSeen") === true)).resolves.toBe(
    false,
  );
});

test("starting from the plan on a weekday the learner rests opens today's session, with no new-week note", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const goal = await createMappedGoal(noProgressUser.id);
  // Today reads the learner's day in the goal's time zone, UTC without one.
  const today = getDateInTimeZone({ date: new Date(), timeZone: goal.timezone ?? "UTC" });

  // Onboarding is done but for the plan, which starts today: a weekday the learner rests.
  const weekdayMinutes = Array.from({ length: 7 }, (_, weekday) =>
    weekday === today.getUTCDay() ? 0 : 30,
  );

  await Promise.all([
    prisma.goal.update({
      data: { details: { answered: [...ANSWERED, "placement"], subject: "algebra" } },
      where: { id: goal.id },
    }),
    prisma.plan.update({
      data: { settings: { startDate: today.toISOString().slice(0, 10), weekdayMinutes } },
      where: { goalId: goal.id },
    }),
  ]);

  await page.goto(`/start/${goal.id}`);
  await expect(page.getByRole("heading", { level: 1, name: "Your plan is ready" })).toBeVisible();

  // The plan is built from the answers: changing them is in "Adjust", not back through them.
  await expect(page.getByRole("button", { name: "Back" })).toHaveCount(0);

  await page.getByRole("link", { name: "Start" }).click();
  await expect(page).toHaveURL(/\/today$/u);

  const card = page.getByRole("region", { name: "Today's session" });
  await expect(card).toBeVisible();
  await expect(card.getByRole("heading", { name: "No study planned today" })).toHaveCount(0);
  await expect(page.getByText(/fresh week/u)).toHaveCount(0);
});

test("an exam's plan waits on the reveal while its notice is read, and says when it follows the usual structure", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const goal = await createMappedGoal(noProgressUser.id);

  // Placement is done; research is still reading the exam's notice.
  await Promise.all([
    prisma.goal.update({
      data: { details: { answered: [...ANSWERED, "placement"], subject: "algebra" } },
      where: { id: goal.id },
    }),
    prisma.plan.update({ data: { noticeWaitUntil: inMinutes(10) }, where: { goalId: goal.id } }),
  ]);

  await page.goto(`/start/${goal.id}`);

  await expect(
    page.getByRole("heading", { level: 1, name: "Reading the exam notice" }),
  ).toBeVisible();

  await expect(page.getByRole("link", { name: "Start" })).toHaveCount(0);
  await expectAccessibleScreen(page, "the plan waiting for the exam notice");

  // The reading lands in the plan: the reveal shows it by itself.
  await prisma.plan.update({ data: { noticeWaitUntil: null }, where: { goalId: goal.id } });

  await expect(page.getByRole("heading", { level: 1, name: "Your plan is ready" })).toBeVisible();
  await expect(page.getByText(/usual structure/u)).toHaveCount(0);

  // Past the wait, the plan shows the exam's usual structure and says what happens next.
  await prisma.plan.update({
    data: { noticeWaitUntil: inMinutes(-1) },
    where: { goalId: goal.id },
  });

  await page.reload();

  await expect(page.getByRole("heading", { level: 1, name: "Your plan is ready" })).toBeVisible();

  await expect(
    page.getByText(
      "This plan follows the exam's usual structure while we finish reading its notice. If the notice changes your plan, you'll decide on Today.",
    ),
  ).toBeVisible();
});

test("the reveal says when the exam notice puts the exam on another day, and leaves the choice to Today", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const goal = await createMappedGoal(noProgressUser.id);
  const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });

  // She said March; the notice sets the exam for another day, which waits for her answer.
  await Promise.all([
    prisma.goal.update({
      data: { details: { answered: [...ANSWERED, "placement"], subject: "algebra" } },
      where: { id: goal.id },
    }),
    planChangeFixture({
      kind: "edited",
      payload: {
        operations: [
          {
            estimated: false,
            kind: "setNoticeDate",
            targetDate: inMinutes(60 * 24 * 90)
              .toISOString()
              .slice(0, "YYYY-MM-DD".length),
          },
        ],
        source: "notice",
      },
      planId: plan.id,
      reason: "",
      status: "proposed",
    }),
  ]);

  await page.goto(`/start/${goal.id}`);

  await expect(page.getByRole("heading", { level: 1, name: "Your plan is ready" })).toBeVisible();

  await expect(
    page.getByText(
      /^The exam notice puts the exam on .+\. You'll choose on Today which date your plan follows\.$/u,
    ),
  ).toBeVisible();

  await page.getByRole("link", { name: "Start" }).click();

  const note = page.getByRole("region", { name: "Suggested change" });
  await expect(note).toContainText(/^The exam notice puts the exam on /u);
  await expect(note.getByRole("button", { name: "Keep mine" })).toBeVisible();
});

test("an exam's placement says how many areas it covers in one sentence", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const id = randomUUID();

  const blueprint = await prisma.examBlueprint.create({
    data: {
      country: "BR",
      identityKey: `e2e-exam-${id}`,
      language: "en",
      model: "test",
      name: `Test exam ${id}`,
      promptVersion: "test",
      runId: "test",
      structure: {
        formats: [],
        mock: null,
        rules: [],
        subjects: ["Languages", "Humanities", "Science", "Math"].map((name) => ({
          citation: { passage: name, sourceId: id },
          name,
          questions: 45,
          topics: [],
          weight: null,
        })),
      },
    },
  });

  const goal = await createMappedGoal(noProgressUser.id);

  await prisma.goal.update({
    data: {
      details: { answered: [...ANSWERED, "target"], subject: "ENEM" },
      examBlueprintId: blueprint.id,
      kind: "exam",
    },
    where: { id: goal.id },
  });

  await page.goto(`/start/${goal.id}`);

  await expect(
    page.getByText(
      "A few quick questions about the 4 areas, so your plan skips what you already know.",
    ),
  ).toBeVisible();

  // The count says enough: the areas live on the exam's page, not in a list here.
  await expect(page.getByText("Humanities", { exact: true })).toBeHidden();
  await expect(page.getByRole("button", { exact: true, name: "Start" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start from zero" })).toBeVisible();
});

test("an exam with several subjects asks which ones the learner already knows well", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const id = randomUUID();
  const constitutional = "Noções de Direito Constitucional e de Regimento Interno";

  const blueprint = await prisma.examBlueprint.create({
    data: {
      country: "BR",
      identityKey: `e2e-exam-${id}`,
      language: "en",
      model: "test",
      name: `Test exam ${id}`,
      promptVersion: "test",
      runId: "test",
      structure: {
        formats: [],
        mock: null,
        rules: [],
        subjects: [
          { name: "Língua Portuguesa", questions: 30, shortName: null },
          { name: constitutional, questions: 30, shortName: "Direito Constitucional" },
          { name: "Tecnologia da Informação", questions: 30, shortName: null },
          // The notice's written test is listed with its subjects, but it isn't one to know well.
          { name: "Prova discursiva", questions: null, shortName: null },
        ].map((subject) => ({
          ...subject,
          citation: { passage: subject.name, sourceId: id },
          topics: [],
          weight: null,
        })),
      },
    },
  });

  const goal = await createMappedGoal(noProgressUser.id);

  await prisma.goal.update({
    data: {
      details: { answered: ANSWERED.filter((question) => question !== "level"), subject: "Câmara" },
      examBlueprintId: blueprint.id,
      kind: "exam",
    },
    where: { id: goal.id },
  });

  await page.goto(`/start/${goal.id}`);

  const question = "Which subjects do you already know well?";
  await expect(page.getByRole("heading", { name: question })).toBeVisible();

  // A long official name shows as learners call it; nothing picked asks the quick test alone.
  await expect(page.getByRole("button", { name: "None of them yet" })).toBeVisible();

  await expect(page.getByRole("checkbox")).toHaveCount(3);
  await expect(page.getByRole("checkbox", { name: "Prova discursiva" })).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Direito Constitucional" }).click();
  await expectAccessibleScreen(page, question);
  await page.getByRole("button", { exact: true, name: "Continue" }).click();

  await expect(
    page.getByRole("heading", { name: "Let's see what you already know" }),
  ).toBeVisible();

  await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
    details: { knownSubjects: [constitutional] },
  });
});

test("after an answer, placement waits for its next questions instead of repeating one", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const id = randomUUID().slice(0, 8);

  const goal = await goalFixture({
    details: { answered: ANSWERED, subject: "algebra" },
    prompt: `learn algebra ${id}`,
    title: `Learn algebra ${id}`,
    userId: noProgressUser.id,
  });

  const skills = await Promise.all(
    [1, 2, 3].map((index) => skillFixture({ name: `Skill ${index} ${id}` })),
  );

  // The skill map is written, but questions exist only for the middle skill so far.
  const plan = await planFixture({
    goalId: goal.id,
    graph: {
      phases: [{ milestone: null, name: "Stage 1" }],
      skills: skills.map((skill) => ({
        area: null,
        lessons: 1,
        name: skill.name,
        phase: 0,
        skillId: skill.id,
        weight: null,
      })),
    },
  });

  await Promise.all([
    ...skills.map((skill, position) =>
      planItemFixture({
        kind: "lesson",
        phase: 0,
        planId: plan.id,
        position,
        skillId: skill.id,
        titleSnapshot: `Lesson ${position + 1}`,
      }),
    ),
    itemFixture({ content: choiceItemContent(`First ${id}?`), skillId: skills[1]?.id ?? "" }),
  ]);

  await page.goto(`/start/${goal.id}`);
  await page.getByRole("button", { exact: true, name: "Start" }).click();

  await expect(page.getByText("Question 1", { exact: true })).toBeVisible();
  await page.keyboard.press("1");
  await expect(page.getByRole("radio", { name: /Right answer/u })).toBeChecked();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("heading", { name: "Getting your questions ready" })).toBeVisible();

  await itemFixture({ content: choiceItemContent(`Next ${id}?`), skillId: skills[2]?.id ?? "" });

  await expect(page.getByText("Question 2", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: new RegExp(`Next ${id}`, "u") })).toBeVisible();
});

test.describe("Typed placement answers", () => {
  test("a right pick is confirmed with an answer in the learner's own words", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const id = randomUUID().slice(0, 8);

    const [goal, skill] = await Promise.all([
      goalFixture({
        details: { answered: ANSWERED, subject: "fractions" },
        prompt: `learn fractions ${id}`,
        title: `Learn fractions ${id}`,
        userId: noProgressUser.id,
      }),
      skillFixture({ name: `Adding fractions ${id}` }),
    ]);

    const plan = await planFixture({
      goalId: goal.id,
      graph: {
        phases: [{ milestone: null, name: "Stage 1" }],
        skills: [
          { area: null, lessons: 1, name: skill.name, phase: 0, skillId: skill.id, weight: null },
        ],
      },
    });

    await Promise.all([
      planItemFixture({
        kind: "lesson",
        phase: 0,
        planId: plan.id,
        position: 0,
        skillId: skill.id,
        titleSnapshot: "Lesson 1",
      }),
      itemFixture({ content: choiceItemContent(`Quick ${id}?`), skillId: skill.id }),
      itemFixture({
        content: {
          acceptedAnswers: ["5/6"],
          context: null,
          keyPoints: ["Adds the fractions as sixths"],
          question: `How much is 1/2 + 1/3? ${id}`,
          sampleAnswer: "3/6 + 2/6 = 5/6",
        },
        format: "typed",
        skillId: skill.id,
      }),
    ]);

    await page.goto(`/start/${goal.id}`);
    await page.getByRole("button", { exact: true, name: "Start" }).click();

    await expect(page.getByText("Question 1", { exact: true })).toBeVisible();
    await page.keyboard.press("1");
    await page.keyboard.press("Enter");

    // A right pick could be a guess, so the next question asks for the answer in words.
    await expect(page.getByText("Question 2", { exact: true })).toBeVisible();
    const answer = page.getByLabel("Your answer, in your own words");
    await expect(answer).toBeFocused();
    await answer.fill("5/6");

    // Enter sends it once the question is ready, like Confirm.
    await expect(page.getByRole("button", { name: "Confirm" })).toBeEnabled();
    await page.keyboard.press("Enter");

    // Both answers settle the only skill, so placement is done.
    await expect(page.getByText("Your starting point is set")).toBeVisible();
    await page.getByRole("button", { name: "See my plan" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Your plan is ready" })).toBeVisible();

    await expect(
      prisma.attempt.findFirst({ where: { item: { format: "typed" }, userId: noProgressUser.id } }),
    ).resolves.toMatchObject({ isCorrect: true });
  });

  test("stops after the day's few minutes and leaves the rest to the first sessions", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const goal = await createMappedGoal(noProgressUser.id);

    // The plan's first skill: right answers there leave the skills after it still to ask about.
    const first = await prisma.planItem.findFirstOrThrow({
      orderBy: { position: "asc" },
      where: { plan: { goalId: goal.id } },
    });

    const item = await prisma.item.findFirstOrThrow({ where: { skillId: first.skillId ?? "" } });

    // Earlier today, placement already took all but one of the day's answers. "Today" is the
    // learner's day in the browser's time zone, which differs from the UTC day late at night.
    const localDate = getDateInTimeZone({ date: new Date(), timeZone: getLocalTimeZone() });

    await Promise.all(
      Array.from({ length: DAY_PLACEMENT_ANSWERS - 1 }, () =>
        attemptFixture({
          itemId: item.id,
          localDate,
          skillId: item.skillId,
          userId: noProgressUser.id,
        }),
      ),
    );

    // Placement already began for this goal, so coming back opens its next question.
    await page.goto(`/start/${goal.id}`);

    await expect(page.getByRole("heading", { name: /^Question/u })).toBeVisible();

    await expect(
      page.getByRole("heading", { name: "Let's see what you already know" }),
    ).toBeHidden();

    await page.keyboard.press("1");
    await page.keyboard.press("Enter");

    await expect(page.getByText("That's enough questions for today")).toBeVisible();
    await expect(page.getByText(/Your first sessions ask a few more/u)).toBeVisible();
    await page.getByRole("button", { name: "See my plan" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Your plan is ready" })).toBeVisible();
  });
});
