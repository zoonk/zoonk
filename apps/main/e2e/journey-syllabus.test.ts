import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";
import { z } from "zod";
import { expect, test } from "./fixtures";
import { tabTo } from "./keyboard-focus";
import { createStudyDay, openAs } from "./study-day";

/**
 * The structure of a goal, visible and trustworthy: a concurso's notice subjects (grouped as the
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
 * A concurso learner three months from the exam. Portuguese: spelling studied, cohesion begun, verb
 * tenses taught by no skill yet. Constitutional law ahead (the plan calls it "Constitutional Law"). The
 * legislative process taken out of the plan, and an exam-strategy area the notice doesn't list.
 */
async function createConcursoLearner() {
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
    status: "done" | "todo" = "todo",
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
    lesson(3, principlesChapter.id, principles.id),
    lesson(4, rulesChapter.id, houseRules.id),
    lesson(5, timingChapter.id, timing.id),
    planItemFixture({ kind: "mock", planId: plan.id, position: 6, scheduledFor: day(6) }),
    planItemFixture({ kind: "boss", planId: plan.id, position: 7, scheduledFor: day(8) }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
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
  test("a concurso learner sees every subject of the notice, ticks its topics and comes back from a chapter", async ({
    browser,
  }) => {
    const { cohesionChapter, goal, user } = await createConcursoLearner();
    const page = await openAs(browser, user);
    await page.goto("/journey");

    // The path is a timeline: the phase she's in with its challenge, no chapters. Mocks come with
    // Plus, so her free plan's path leaves them out instead of listing ones she can't take.
    const path = page.getByRole("list", { name: "Your journey" });
    const current = path.locator('li[aria-current="step"]');

    await expect(current.getByRole("link", { name: /^Mock exam/u })).toHaveCount(0);
    await expect(path.getByText(/^\d+ mock exams?$/u)).toHaveCount(0);

    await expect(current.getByRole("link", { name: /^Phase challenge/u })).toBeVisible();
    await expect(path.getByRole("link", { name: /Linking ideas/u })).toHaveCount(0);

    // What's on the exam: the notice's subjects in its groups, then what the plan adds.
    const syllabus = page.getByRole("region", { name: "What's on the exam" });
    await expect(syllabus.getByText("3 subjects · 8 topics")).toBeVisible();

    await expect(syllabus.getByRole("heading", { level: 3 })).toHaveText([
      "Basic knowledge (P1)",
      "Specific knowledge (P2)",
      "Beyond the notice",
    ]);

    // Each subject with its questions on the exam, as the notice counts them.
    await expect(syllabus.getByRole("link")).toHaveText([
      `${PORTUGUESE}1 of 3 topics30 questions`,
      `${CONSTITUTIONAL}0 of 3 topics20 questions`,
      `${PROCESS}Not in your plan10 questions`,
      "Exam strategy0 of 1 lesson",
    ]);

    // A subject's page: its topics in the notice's words, each ticked, opening to its chapters.
    await syllabus.getByRole("link", { name: new RegExp(`^${PORTUGUESE}`, "u") }).click();
    await expect(page).toHaveURL(/\/journey\/portuguese-language$/u);
    await expect(page.getByRole("heading", { level: 1, name: PORTUGUESE })).toBeVisible();
    await expect(page.getByText("Basic knowledge (P1)").filter({ visible: true })).toBeVisible();
    await expect(page.getByRole("article").getByText("30 questions")).toBeVisible();

    // How far, at a glance: "Continue" with the share of the notice's topics studied, into the
    // next chapter, and the topics studied beside the notice's topics.
    const subjectPage = page.getByRole("article");

    await expect(
      subjectPage.getByRole("link", { name: /^Continue\s*33% complete$/u }),
    ).toBeVisible();

    await expect(subjectPage.getByText("1 of 3 topics", { exact: true })).toBeVisible();

    // The chapters lead: the one done folded into the list's first row, the next one marked.
    const chapters = page.getByRole("region", { name: "Chapters" });
    const next = chapters.getByRole("link", { name: /Linking ideas/u });

    await expect(next).toContainText(/up next/iu);
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
    await expect(back).toHaveAttribute("href", "/journey/portuguese-language");
    await back.click();
    await expect(page).toHaveURL(/\/journey\/portuguese-language$/u);

    await page.getByRole("main").getByRole("link", { name: "Back to Journey" }).click();
    await expect(page).toHaveURL(/\/journey$/u);

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

    await page.getByRole("main").getByRole("link", { name: "Back to Journey" }).click();
    await expect(page).toHaveURL(/\/journey$/u);

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

  test("an entrance exam learner studies its contents under the notice's headings, sees the ones asked most, its skills matrix as the notice prints it and how their course weighs the parts", async ({
    browser,
  }) => {
    const { user } = await createEntranceExamLearner();
    const page = await openAs(browser, user);
    await page.goto("/journey");

    const syllabus = page.getByRole("region", { name: "What's on the exam" });

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
    // matrix: each competência a row with its label, opening to every skill with its own code.
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

  test("Today labels each lesson with its subject and says the day's subjects", async ({
    browser,
  }) => {
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
    await expect(card.getByText("Math and Economics", { exact: true })).toBeVisible();
    await expect(card.getByText(/^Up next\s*\d+ min\s*Economics$/u)).toBeVisible();

    // The block after this one is in sight with its subject; the last row shows the whole day.
    await expect(card.getByRole("list").getByRole("listitem")).toHaveText([
      /^Mixed practice\s*Math/u,
    ]);

    await card.getByRole("button", { name: /^See today's \d+ activities/u }).click();

    await expect(card.getByRole("list").getByRole("listitem")).toHaveText([
      /^Quick review, done\s*Math/u,
      /^Discounts in your head\s*Economics/u,
      /^Mixed practice\s*Math/u,
    ]);

    await page.context().close();
  });
});
