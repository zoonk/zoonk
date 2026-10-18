import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";
import { z } from "zod";
import { expect, test } from "./fixtures";
import { tabTo } from "./keyboard-focus";
import { stubScreenTutor } from "./screen-tutor";
import { createStudyDay, openAs, pastFreeWeek } from "./study-day";

/**
 * The structure of a goal, visible and trustworthy: a civil service exam's notice subjects (grouped as the
 * notice groups them) with their topics ticked from the plan, each subject's page with its topics
 * and chapters, and the way back from a chapter to its subject. Today labels lessons with their
 * subject.
 */

const PORTUGUESE = "Portuguese Language";
const CONSTITUTIONAL = "Notions of Constitutional Law and House Rules";
const PROCESS = "Legislative Process";
const SKIPPED_AREA = "Legislative Process";
const DAYS_TO_EXAM = 90;

const citation = { passage: "Syllabus", sourceId: "notice" };

const settingsSchema = z.object({ skippedAreas: z.array(z.string()) });

function noticeSubject({
  group,
  name,
  questions,
  topics,
}: {
  group: string;
  name: string;
  questions: number;
  topics: string[];
}) {
  return { citation, group, name, questions, topics, weight: null };
}

/** A skill of the plan's graph in an area, with the notice topics it teaches. */
function graphSkill({
  area,
  row,
  topics,
}: {
  area: string;
  row: { id: string; name: string };
  topics: string[];
}) {
  return { area, lessons: 2, name: row.name, phase: 0, skillId: row.id, topics };
}

/**
 * A civil service candidate three months from the exam. Portuguese: spelling studied, cohesion begun, verb
 * tenses taught by no skill yet. Constitutional law ahead (the plan calls it "Constitutional Law"). The
 * legislative process taken out of the plan, and an exam-strategy area the notice doesn't list. With
 * `setAside`, days she missed set a second spelling lesson aside. With `lawLeftOut`, her time left
 * constitutional law out of the plan.
 */
async function createCivilServiceLearner({
  lawLeftOut = false,
  setAside = false,
}: { lawLeftOut?: boolean; setAside?: boolean } = {}) {
  const user = await createE2EUser(getBaseURL());
  const today = toUTCMidnight(new Date());
  const day = (offset: number) => new Date(today.getTime() + offset * MS_PER_DAY);

  const [blueprint, spelling, cohesion, principles, houseRules, bills, timing] = await Promise.all([
    examBlueprintFixture({
      edition: {
        citations: [],
        dates: [],
        noticeUrl: null,
        questionCount: 120,
        sourceHash: null,
        year: 2027,
      },
      name: "House of Representatives exam",
      structure: {
        formats: [],
        mock: null,
        rules: [],
        subjects: [
          noticeSubject({
            group: "Basic knowledge (P1)",
            name: PORTUGUESE,
            questions: 30,
            topics: ["Spelling", "Text cohesion", "Verb tenses"],
          }),
          noticeSubject({
            group: "Basic knowledge (P1)",
            name: CONSTITUTIONAL,
            questions: 20,
            topics: ["1 Fundamental principles", "1.1 Separation of powers", "2 House rules"],
          }),
          noticeSubject({
            group: "Specific knowledge (P2)",
            name: PROCESS,
            questions: 10,
            topics: ["Bills", "Votes"],
          }),
        ],
      },
    }),
    skillFixture({ name: "Spell words right" }),
    skillFixture({ name: "Link ideas in a text" }),
    skillFixture({ name: "Apply the fundamental principles" }),
    skillFixture({ name: "Follow the House rules" }),
    skillFixture({ name: "Tell bills apart" }),
    skillFixture({ name: "Manage the exam's time" }),
  ]);

  const [goal, spellingChapter, cohesionChapter, principlesChapter, rulesChapter, timingChapter] =
    await Promise.all([
      goalFixture({
        examBlueprintId: blueprint.id,
        kind: "exam",
        targetDate: day(DAYS_TO_EXAM),
        timezone: "UTC",
        title: "House of Representatives exam",
        userId: user.id,
      }),
      libraryChapterFixture({ title: "Spelling in context" }),
      libraryChapterFixture({ title: "Linking ideas" }),
      libraryChapterFixture({ title: "Principles of the Constitution" }),
      libraryChapterFixture({ title: "House rules in practice" }),
      libraryChapterFixture({ title: "Managing exam time" }),
    ]);

  const plan = await planFixture({
    goalId: goal.id,
    graph: {
      phases: [{ milestone: null, name: "Foundations" }],
      skills: [
        graphSkill({ area: PORTUGUESE, row: spelling, topics: ["Spelling"] }),
        graphSkill({ area: PORTUGUESE, row: cohesion, topics: ["Text cohesion"] }),
        graphSkill({
          area: "Constitutional Law",
          row: principles,
          topics: ["Fundamental principles"],
        }),
        graphSkill({ area: "Constitutional Law", row: houseRules, topics: ["House rules"] }),
        graphSkill({ area: SKIPPED_AREA, row: bills, topics: ["Bills"] }),
        graphSkill({ area: "Exam strategy", row: timing, topics: [] }),
      ],
    },
    phases: [{ name: "Foundations" }],
    settings: { skippedAreas: [SKIPPED_AREA] },
  });

  const lesson = (
    position: number,
    chapterId: string,
    skillId: string,
    status: "done" | "skipped" | "todo" = "todo",
  ) =>
    planItemFixture({
      chapterId,
      planId: plan.id,
      position,
      scheduledFor: day(position),
      skillId,
      status,
    });

  await Promise.all([
    lesson(0, spellingChapter.id, spelling.id, "done"),
    lesson(1, cohesionChapter.id, cohesion.id, "done"),
    lesson(2, cohesionChapter.id, cohesion.id),
    !lawLeftOut && lesson(3, principlesChapter.id, principles.id),
    !lawLeftOut && lesson(4, rulesChapter.id, houseRules.id),
    lesson(5, timingChapter.id, timing.id),
    planItemFixture({ kind: "mock", planId: plan.id, position: 6, scheduledFor: day(6) }),
    planItemFixture({ kind: "boss", planId: plan.id, position: 7, scheduledFor: day(8) }),
    setAside && lesson(8, spellingChapter.id, spelling.id, "skipped"),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    // She opened Today earlier, so her day is built. Otherwise building it (Today's link prefetch
    // does) plans this hand-written plan again from its graph, sometimes before her subject page
    // reads it, and cohesion's lesson to go is gone.
    studySessionFixture({ goalId: goal.id, userId: user.id }),
  ]);

  return { cohesionChapter, goal, user };
}

const NATURE = "Natural Sciences and their Technologies";
const MATH = "Mathematics and its Technologies";

/**
 * An entrance exam learner whose notice pairs a skills matrix with the contents it tests: the
 * contents are the topics, under the notice's own headings (Physics, Biology), the matrix is detail,
 * and their course counts Natural Sciences double. A source of past papers says which contents
 * the exam asks most.
 */
async function createEntranceExamLearner() {
  const user = await createE2EUser(getBaseURL());
  const today = toUTCMidnight(new Date());

  const [blueprint, cells, numbers] = await Promise.all([
    examBlueprintFixture({
      name: "Entrance exam",
      structure: {
        formats: [],
        mock: null,
        pastTopicFrequency: {
          checkedAt: new Date().toISOString(),
          subjects: [
            {
              basis: "questions from 2015 to 2025",
              name: NATURE,
              source: { title: "Most asked", url: "https://www.example.com/most-asked" },
              topics: [
                { appearances: null, level: "high", topic: "Molecules, cells and tissues" },
                { appearances: null, level: "medium", topic: "Energy, work and power" },
              ],
            },
          ],
        },
        rules: [],
        subjects: [
          {
            ...noticeSubject({
              group: "Objective tests",
              name: NATURE,
              questions: 45,
              topics: [
                "Energy, work and power",
                "Molecules, cells and tissues",
                "Heredity and the diversity of life",
              ],
            }),
            matrix: [
              "Area competence 4 – Understand how organisms interact with the environment",
              "H13 – Recognize how life is passed on and predict the traits of living beings",
            ],
            shortName: "Natural Sciences",
            topicGroups: [
              { name: "Physics", topics: ["Energy, work and power"] },
              {
                name: "Biology",
                topics: ["Molecules, cells and tissues", "Heredity and the diversity of life"],
              },
            ],
          },
          {
            ...noticeSubject({
              group: "Objective tests",
              name: MATH,
              questions: 45,
              topics: ["Numbers"],
            }),
            shortName: "Mathematics",
          },
        ],
      },
    }),
    skillFixture({ name: "Explain how cells work" }),
    skillFixture({ name: "Work with numbers" }),
  ]);

  const goal = await goalFixture({
    details: {
      courseWeights: {
        course: "Medicine",
        edition: "SISU 2026",
        institution: "UFMG",
        source: { title: "Weights", url: "https://www.ufmg.br/sisu/weights.pdf" },
        status: "found",
        subjects: [
          { name: NATURE, weight: 2 },
          { name: MATH, weight: 1 },
        ],
      },
      institution: "UFMG",
      targetCourse: "Medicine",
    },
    examBlueprintId: blueprint.id,
    kind: "exam",
    targetDate: new Date(today.getTime() + DAYS_TO_EXAM * MS_PER_DAY),
    timezone: "UTC",
    title: "Entrance exam",
    userId: user.id,
  });

  const [chapter, plan] = await Promise.all([
    libraryChapterFixture({ title: "Cells up close" }),
    planFixture({
      goalId: goal.id,
      graph: {
        phases: [{ milestone: null, name: "Foundations" }],
        skills: [
          graphSkill({ area: NATURE, row: cells, topics: ["Molecules, cells and tissues"] }),
          graphSkill({ area: MATH, row: numbers, topics: ["Numbers"] }),
        ],
      },
      phases: [{ name: "Foundations" }],
    }),
  ]);

  await Promise.all([
    planItemFixture({
      chapterId: chapter.id,
      planId: plan.id,
      position: 0,
      scheduledFor: today,
      skillId: cells.id,
    }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
  ]);

  return { user };
}

async function readSkippedAreas(goalId: string) {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId } });
  return settingsSchema.parse(plan.settings).skippedAreas;
}

test.describe("A goal's structure", () => {
  // Past a free exam plan's first week its phase challenge comes with Plus: the path said nothing
  // while its page offered Plus.
  test("past a free exam plan's first week, the path marks its phase challenge Plus", async ({
    browser,
  }) => {
    const { goal, user } = await createCivilServiceLearner();
    await pastFreeWeek(goal.id);

    const page = await openAs(browser, user);
    await page.goto("/plan");

    const next = page.getByRole("region", { name: "Next on your path" });

    await expect(
      next.getByRole("link", { name: /^Phase challenge.*Available with Plus/u }),
    ).toHaveAttribute("href", /^\/challenge\/[\da-f-]{36}$/u);

    await expect(
      page.getByText("Your free week of exam prep is over").filter({ visible: true }),
    ).toBeVisible();

    await page.context().close();
  });

  // Her time left constitutional law out of the plan, but the exam still tests it, so her
  // preparation counts it: with no number on its row, her overall sat under every subject she
  // could see. The one she took out isn't counted, so it has none.
  test("a subject her time left out shows its preparation, which her overall counts", async ({
    browser,
  }) => {
    const { user } = await createCivilServiceLearner({ lawLeftOut: true });
    const page = await openAs(browser, user);
    await page.goto("/plan");

    const syllabus = page.getByRole("region", { exact: true, name: "Subjects" });

    await expect(syllabus.getByRole("link", { name: /^(?!download)/u })).toHaveText([
      new RegExp(`^${PORTUGUESE}30 questions[<>]?\\d+%$`, "u"),
      new RegExp(`^${CONSTITUTIONAL}20 questionsNot in your plan[<>]?\\d+%$`, "u"),
      `${PROCESS}10 questionsNot in your plan`,
      /^Exam strategy[<>]?\d+%$/u,
    ]);

    // Its page says why it's out, and the same preparation.
    await syllabus.getByRole("link", { name: new RegExp(`^${CONSTITUTIONAL}`, "u") }).click();
    await expect(page.getByText("It doesn't fit in the time you have.")).toBeVisible();

    await expect(
      page.locator('[data-slot="subject-preparation"]').filter({ visible: true }),
    ).toContainText(/\d+%/u);

    await page.context().close();
  });

  test("a civil service candidate sees every subject of the notice, ticks its topics and comes back from a chapter", async ({
    browser,
  }) => {
    const { cohesionChapter, goal, user } = await createCivilServiceLearner();
    const page = await openAs(browser, user);
    const asked = await stubScreenTutor(page);
    await page.goto("/plan");

    // What's next on her path: her next mock and the challenge that closes her phase, no
    // chapters (they live under the subjects). Mocks come with Plus: her free plan shows them as
    // they are, marked Plus.
    const next = page.getByRole("region", { name: "Next on your path" });

    // Her free week isn't over yet: the challenge is hers to take.
    await expect(next.getByRole("link", { name: /^Phase challenge/u })).toBeVisible();
    await expect(next.getByRole("link", { name: /^Phase challenge.*Plus/u })).toHaveCount(0);

    await expect(
      next.getByRole("link", { name: /^Mock exam.*Available with Plus/u }),
    ).toHaveAttribute("href", "/exam");

    await expect(next.getByRole("link", { name: /Linking ideas/u })).toHaveCount(0);

    // Her mock exams are one of her plan's properties too, said only as regular as their planned
    // days are; they aren't a setting, so the row opens the exam's page, where they are.
    await expect(
      page
        .getByRole("region", { exact: true, name: "Your plan" })
        .getByRole("link", { name: /^Mock exams.*Available with Plus/u }),
    ).toHaveAttribute("href", "/exam");

    // The subjects: the notice's subjects in its groups, then what the plan adds, counted in the
    // note under them.
    const syllabus = page.getByRole("region", { exact: true, name: "Subjects" });
    await expect(syllabus.getByText(/^3 subjects · 8 topics/u)).toBeVisible();

    await expect(syllabus.getByRole("heading", { level: 3 })).toHaveText([
      "Basic knowledge (P1)",
      "Specific knowledge (P2)",
      "Beyond the notice",
    ]);

    // Each subject on one row: its name, its questions on the exam as the notice counts them (a
    // column of their own where the list is wide), its bar and the share done at its end; one she
    // took out of the plan says so where its bar would be, with no share: her overall doesn't
    // count it.
    await expect(syllabus.getByRole("link", { name: /^(?!download)/u })).toHaveText([
      new RegExp(`^${PORTUGUESE}30 questions[<>]?\\d+%$`, "u"),
      new RegExp(`^${CONSTITUTIONAL}20 questions[<>]?\\d+%$`, "u"),
      `${PROCESS}10 questionsNot in your plan`,
      /^Exam strategy[<>]?\d+%$/u,
    ]);

    // A subject's page: its topics in the notice's words, each ticked, opening to its chapters.
    await syllabus.getByRole("link", { name: new RegExp(`^${PORTUGUESE}`, "u") }).click();
    await expect(page).toHaveURL(/\/plan\/portuguese-language$/u);
    await expect(page.getByRole("heading", { level: 1, name: PORTUGUESE })).toBeVisible();
    await expect(page.getByText("Basic knowledge (P1)").filter({ visible: true })).toBeVisible();
    await expect(page.getByRole("article").getByText("30 questions")).toBeVisible();

    // Her buddy answers about the subject, beside its facts. Opening it asks nothing: only what
    // she sends is answered.
    await page.getByRole("button", { name: "Ask Zu about this subject" }).click();
    const tutor = page.getByRole("dialog", { name: "Zu" });
    await expect(tutor.getByText("Ask questions about this subject")).toBeVisible();
    expect(asked).toStrictEqual([]);

    await tutor.getByRole("button", { name: "What's left to study here?" }).click();

    await expect(
      tutor.getByText("Here's the short version, from what the screen shows."),
    ).toBeVisible();

    expect(asked).toStrictEqual([
      {
        input: expect.objectContaining({
          context: { kind: "subject" },
          question: "What's left to study here?",
        }),
        path: `/v1/goals/${goal.id}/subjects/portuguese-language/questions`,
      },
    ]);

    await page.keyboard.press("Escape");
    await expect(tutor).toBeHidden();

    // How far, at a glance: "Continue" with the share of the notice's topics studied, into the
    // next chapter, and the topics studied beside the notice's topics.
    const subjectPage = page.getByRole("article");

    await expect(subjectPage.getByRole("link", { exact: true, name: "Continue" })).toBeVisible();

    await expect(subjectPage.getByText("1 of 3 topics", { exact: true })).toBeVisible();

    // The chapters lead: the one done folded into the list's first row, the next one marked.
    const chapters = page.getByRole("region", { name: "Chapters" });
    const nextChapter = chapters.getByRole("link", { name: /Linking ideas/u });

    await expect(nextChapter.locator("xpath=ancestor::li[1]")).toHaveAttribute(
      "aria-current",
      "step",
    );

    await expect(chapters.getByRole("link", { name: /Spelling in context/u })).toBeHidden();
    await chapters.getByRole("button", { name: "1 chapter done" }).click();
    await expect(chapters.getByRole("link", { name: /Spelling in context/u })).toBeVisible();

    const topicsSection = page.getByRole("region", { name: "Topics in the notice" });
    const topics = topicsSection.getByRole("list").first().getByRole("listitem");

    await expect(topics).toHaveText([
      "Spelling, studied",
      /^Text cohesion, in progress/u,
      "Verb tenses, not in your planNo lessons on it yet",
    ]);

    await expectAccessibleScreen(page, "a subject's page");

    // From the keyboard too: the topic opens in place to the chapter that teaches it.
    const cohesionTopic = topicsSection.getByRole("button", { name: /^Text cohesion/u });
    await tabTo(page, cohesionTopic);
    await page.keyboard.press("Enter");
    await expect(cohesionTopic).toHaveAttribute("aria-expanded", "true");

    const chapter = topicsSection.getByRole("link", { name: /Linking ideas/u });

    await expect(chapter).toHaveAttribute(
      "href",
      `/content/chapters/${cohesionChapter.id}?from=portuguese-language`,
    );

    // The chapter's way back is the subject it was opened from, by name, and it's numbered in
    // that subject as the subject's page lists it.
    await chapter.click();
    await expect(page.getByText(`${PORTUGUESE} · Chapter 2`, { exact: true })).toBeVisible();
    const back = page.getByRole("main").getByRole("link", { name: `Back to ${PORTUGUESE}` });
    await expect(back).toHaveAttribute("href", "/plan/portuguese-language");
    await back.click();
    await expect(page).toHaveURL(/\/plan\/portuguese-language$/u);

    await page.getByRole("main").getByRole("link", { name: "Back to Plan" }).click();
    await expect(page).toHaveURL(/\/plan$/u);

    // The notice's own outline with its own numbers, each item with the ones under it folded in,
    // so the learner can check it against the notice item by item.
    await page.getByRole("link", { name: new RegExp(`^${CONSTITUTIONAL}`, "u") }).click();
    const outline = page.getByRole("region", { name: "Topics in the notice" });
    const principles = outline.getByRole("button", { name: /^1 Fundamental principles/u });

    await expect(outline.getByRole("list").first().getByRole("listitem")).toHaveText([
      /^1 Fundamental principles, to study0\/2/u,
      /^2 House rules, to study/u,
    ]);

    await principles.click();

    await expect(outline.getByText("1.1 Separation of powers", { exact: false })).toContainText(
      "not in your plan",
    );

    // The plan's third chapter is this subject's first, and its page says so.
    const principlesChapter = page
      .getByRole("region", { name: "Chapters" })
      .getByRole("link", { name: /Principles of the Constitution/u });

    await expect(principlesChapter).toContainText("1. Principles of the Constitution");
    await principlesChapter.click();
    await expect(page.getByText("Constitutional Law · Chapter 1", { exact: true })).toBeVisible();
    await page.getByRole("main").getByRole("link", { name: "Back to Constitutional Law" }).click();

    await page.getByRole("main").getByRole("link", { name: "Back to Plan" }).click();
    await expect(page).toHaveURL(/\/plan$/u);

    // A subject taken out of the plan says so, and one tap brings it back.
    await page.getByRole("link", { name: new RegExp(`^${PROCESS}`, "u") }).click();
    await expect(page.getByText("You took this subject out of your plan.")).toBeVisible();

    await expect(
      page
        .getByRole("region", { name: "Topics in the notice" })
        .getByRole("list")
        .first()
        .getByRole("listitem"),
    ).toHaveText([/^Bills, not in your plan/u, /^Votes, not in your plan/u]);

    await page.getByRole("button", { name: "Bring it back" }).click();
    await expect.poll(() => readSkippedAreas(goal.id)).toStrictEqual([]);
    await expect(page.getByText("You took this subject out of your plan.")).toBeHidden();

    await page.context().close();
  });

  // Rafaela studied one lesson, then missed days set the next one aside: her subject page said she
  // had studied the topic and finished its chapter.
  test("a lesson set aside never counts as studied on a subject's page", async ({ browser }) => {
    const { user } = await createCivilServiceLearner({ setAside: true });
    const page = await openAs(browser, user);
    await page.goto("/plan/portuguese-language");

    const topics = page
      .getByRole("region", { name: "Topics in the notice" })
      .getByRole("list")
      .first()
      .getByRole("listitem");

    // Nothing of it is left in the plan: begun, and the rest out for time.
    await expect(topics.first()).toHaveText(/^Spelling, in progress/u);
    await expect(topics.first()).toContainText("Doesn't fit in the time you have");

    await expect(
      page.getByRole("article").getByText("0 of 3 topics", { exact: true }),
    ).toBeVisible();

    const chapters = page.getByRole("region", { name: "Chapters" });
    await expect(chapters.getByRole("link", { name: /Spelling in context/u })).toBeVisible();
    await expect(chapters.getByRole("button", { name: /chapters? done$/u })).toHaveCount(0);

    await page.context().close();
  });

  test("an entrance exam learner studies its contents under the notice's headings, sees the ones asked most, its skills matrix as the notice prints it and how their course weighs the parts", async ({
    browser,
  }) => {
    const { user } = await createEntranceExamLearner();
    const page = await openAs(browser, user);
    await page.goto("/plan");

    const syllabus = page.getByRole("region", { exact: true, name: "Subjects" });

    await expect(
      syllabus.getByText(
        "Medicine at UFMG counts Natural Sciences more, so your plan gives them more of your time. Weights from ufmg.br.",
      ),
    ).toBeVisible();

    await expect(syllabus.getByRole("link", { name: "ufmg.br" })).toHaveAttribute(
      "href",
      "https://www.ufmg.br/sisu/weights.pdf",
    );

    // The subject's topics are the contents candidates study; under them, the notice's skills
    // matrix: each competency a row with its label, opening to every skill with its own code.
    await syllabus.getByRole("link", { name: new RegExp(`^${NATURE}`, "u") }).click();
    const topicsSection = page.getByRole("region", { name: "Topics in the notice" });

    // The notice's own headings group them, and the ones past exams asked most say so, with where
    // that comes from.
    await expect(topicsSection.getByRole("heading", { level: 3 })).toHaveText([
      "Physics",
      "Biology",
    ]);

    await expect(
      topicsSection.getByRole("list", { name: "Physics" }).getByRole("listitem"),
    ).toHaveText([/^Energy, work and power, not in your plan/u]);

    await expect(
      topicsSection.getByRole("list", { name: "Biology" }).getByRole("listitem"),
    ).toHaveText([
      /^Molecules, cells and tissues, to study\s*Appears a lot/u,
      /^Heredity and the diversity of life, not in your plan/u,
    ]);

    await expect(topicsSection.getByText("Appears a lot", { exact: true })).toHaveCount(2);

    await expect(
      topicsSection.getByText(
        /^Topics marked Appears a lot are the ones past exams asked most \(questions from 2015 to 2025, according to example\.com\)\. They get more of your time\.$/u,
      ),
    ).toBeVisible();

    await expect(topicsSection.getByRole("link", { name: "example.com" })).toHaveAttribute(
      "href",
      "https://www.example.com/most-asked",
    );

    const matrix = page.getByRole("region", { name: "What the questions ask" });

    const competence = matrix.getByRole("button", {
      name: /^Understand how organisms interact with the environment\s*Area competence 4/u,
    });

    await expect(competence).toBeVisible();
    await competence.click();

    await expect(
      matrix.getByText(
        "H13 Recognize how life is passed on and predict the traits of living beings",
      ),
    ).toBeVisible();

    await expectAccessibleScreen(page, "a subject's page with its skills matrix");
    await page.context().close();
  });

  test("Today labels each block still to do with its subject", async ({ browser }) => {
    const { goal, session, user } = await createStudyDay({ reviewDone: true });

    const blocks = await prisma.studySessionBlock.findMany({
      orderBy: { position: "asc" },
      where: { sessionId: session.id },
    });

    const skillOf = (position: number) =>
      z.object({ skillIds: z.array(z.string()) }).parse(blocks[position]?.payload).skillIds[0] ??
      "";

    // The day's lesson is economics; its review and practice are math.
    await prisma.plan.update({
      data: {
        graph: {
          phases: [{ milestone: null, name: "Foundations" }],
          skills: [
            { area: "Economics", lessons: 1, name: "Discounts", phase: 0, skillId: skillOf(1) },
            { area: "Math", lessons: 1, name: "Percentages", phase: 0, skillId: skillOf(2) },
          ],
        },
      },
      where: { goalId: goal.id },
    });

    const page = await openAs(browser, user);
    await page.goto("/today");

    const card = page.getByRole("region", { name: "Today's session" });

    // A short day is in sight whole, each block still to do with its subject and the next one
    // highlighted. A done block is one quiet line, its name and minutes only.
    await expect(card.locator('[data-slot="today-next"]')).toContainText(
      /^Discounts in your head\s*Economics/u,
    );

    const rows = card.getByRole("list").getByRole("listitem");

    await expect(rows).toHaveText([
      /^Quick review, done/u,
      /^Discounts in your head\s*Economics/u,
      /^Mixed practice\s*Math/u,
    ]);

    await expect(rows.first()).not.toContainText("Math");

    await page.context().close();
  });
});
