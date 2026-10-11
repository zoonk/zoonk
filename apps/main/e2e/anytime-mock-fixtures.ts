import { randomUUID } from "node:crypto";
import { type Page, expect } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import {
  choiceItemContent,
  itemFixture,
  itemSetFixture,
  skillFixture,
} from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import {
  AREAS,
  FORMATS_QUESTIONS,
  FORMAT_ITEMS,
  TEXT_SET,
  WRITTEN_ESSAY,
  getStructure,
} from "./anytime-mock-exams";
import { ANSWERED } from "./onboarding-fixtures";

const SHORT_ID_LENGTH = 6;
const QUESTIONS_PER_SKILL = 4;
const SKILLS_PER_AREA = 2;

type Question = { area: string; right: string; skill: string; wrong: string };

/** The area of the plan's skill at this index: two per area, in order. */
function areaOf(index: number): string {
  return AREAS[Math.floor(index / SKILLS_PER_AREA)] ?? "";
}

/**
 * An exam learner whose plan has two areas (Mathematics, Languages) of two topics each, one lesson
 * per topic, and four questions per topic in the exam's own bank: enough for a mock of either
 * subject or of the whole day without writing any. `onboarding`: the goal waits at placement, with
 * every earlier question answered. `material: false`: a class test with no material yet, so no
 * exam to copy and no questions in the bank. Returns each question's right and wrong answer by
 * its text.
 */
export async function createAnytimeMockLearner({
  breaks = false,
  formats = false,
  material = true,
  navigation = false,
  onboarding = false,
  plus,
  scale = false,
  textSet = false,
  written = false,
}: {
  /** The exam day has a break between its sections and a practical (`BREAK_STRUCTURE`). */
  breaks?: boolean;
  /** Its Mathematics paper also asks several picks, a fraction and a word (`FORMAT_ITEMS`). */
  formats?: boolean;
  material?: boolean;
  /** Its sections set how candidates move through them (`NAVIGATION_STRUCTURE`). */
  navigation?: boolean;
  /** It's scored on its own scale, with the notice's map and pass score (`SCALE_STRUCTURE`). */
  scale?: boolean;
  onboarding?: boolean;
  plus: boolean;
  /** Three of Mathematics' questions read one text (`TEXT_SET`), written before the others. */
  textSet?: boolean;
  /** The exam day ends with a discursive test, which its full mock asks (`WRITTEN_STRUCTURE`). */
  written?: boolean;
}) {
  const id = randomUUID().slice(0, SHORT_ID_LENGTH);

  const [user, blueprint, skills] = await Promise.all([
    createE2EUser(getBaseURL()),
    examBlueprintFixture({
      language: "en",
      name: `Mock Exam ${id}`,
      structure: getStructure({ breaks, formats, navigation, scale, written }),
    }),
    Promise.all(
      AREAS.flatMap((area) =>
        Array.from({ length: SKILLS_PER_AREA }, (_, index) =>
          skillFixture({ name: `${area} topic ${index + 1} ${id}` }),
        ),
      ),
    ),
  ]);

  const goal = await goalFixture({
    details: onboarding ? { answered: [...ANSWERED, "target"], level: "basic" } : {},
    examBlueprintId: material ? blueprint.id : null,
    kind: "exam",
    timezone: "UTC",
    title: `Mock Exam ${id}`,
    userId: user.id,
  });

  const plan = await planFixture({
    goalId: goal.id,
    graph: {
      phases: [{ milestone: null, name: "Basics" }],
      skills: skills.map((skill, index) => ({
        area: areaOf(index),
        lessons: 1,
        name: skill.name,
        phase: 0,
        skillId: skill.id,
        weight: null,
      })),
    },
  });

  // Written before the bank's other questions, so the mock's first new ones are its.
  const set = textSet
    ? await itemSetFixture({ content: TEXT_SET, examBlueprintId: blueprint.id })
    : null;

  const setQuestions = (set ? [1, 2, 3] : []).map((number) => ({
    content: choiceItemContent(`On the text, question ${number}? ${id}`),
    setPosition: number - 1,
    skill: skills[0],
    skillIndex: 0,
  }));

  const questions = skills.flatMap((skill, index) =>
    Array.from({ length: QUESTIONS_PER_SKILL }, (_, copy) => ({
      content: choiceItemContent(`${skill.name}, question ${copy + 1}?`),
      skill,
      skillIndex: index,
    })),
  );

  await Promise.all([
    ...skills.map((skill, position) =>
      planItemFixture({
        kind: "lesson",
        planId: plan.id,
        position,
        skillId: skill.id,
        titleSnapshot: `Lesson ${position + 1}`,
      }),
    ),
    ...(material ? questions : []).map((question) =>
      itemFixture({
        content: question.content,
        examBlueprintId: blueprint.id,
        skillId: question.skill.id,
      }),
    ),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    ...setQuestions.map((question) =>
      itemFixture({
        content: question.content,
        examBlueprintId: blueprint.id,
        setId: set?.id,
        setPosition: question.setPosition,
        skillId: question.skill?.id ?? "",
      }),
    ),
    ...(formats ? Object.values(FORMAT_ITEMS) : []).map((item) =>
      itemFixture({
        content: item.content,
        examBlueprintId: blueprint.id,
        format: item.format,
        skillId: skills[0]?.id ?? "",
      }),
    ),
    written
      ? itemFixture({
          content: WRITTEN_ESSAY,
          examBlueprintId: blueprint.id,
          format: "essay",
          skillId: skills[0]?.id ?? "",
        })
      : null,
    plus
      ? prisma.subscription.create({
          data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
        })
      : null,
  ]);

  const answers = new Map<string, Question>(
    [...questions, ...setQuestions].map((question) => [
      question.content.question,
      {
        area: areaOf(question.skillIndex),
        right: question.content.options.find((option) => option.isCorrect)?.text ?? "",
        skill: question.skill?.name ?? "",
        wrong: question.content.options.find((option) => !option.isCorrect)?.text ?? "",
      },
    ]),
  );

  return { answers, goal, plan, skills, user };
}

/**
 * Answers the running section's questions in order, from the one on screen: right on the topics
 * `knows` names, wrong on the rest, until `count` are answered (the whole section without it). It
 * moves with Next, which the section's last question doesn't have.
 */
export async function answerMockQuestions({
  answers,
  count,
  knows,
  page,
}: {
  answers: Map<string, Question>;
  count?: number;
  knows: (question: Question) => boolean;
  page: Page;
}) {
  const counter = await page.getByText(/^Question \d+ of \d+/u).textContent();
  const groups = /^Question (?<first>\d+) of (?<total>\d+)/u.exec(counter ?? "")?.groups;
  const first = Number(groups?.first ?? 1);
  const total = Number(groups?.total ?? 0);
  const last = count === undefined ? total : first + count - 1;

  for (let number = first; number <= last; number += 1) {
    // oxlint-disable-next-line no-await-in-loop -- A mock is answered one question at a time.
    await expect(page.getByText(new RegExp(`^Question ${number} of \\d+`, "u"))).toBeVisible();

    // oxlint-disable-next-line no-await-in-loop -- The question on screen decides the answer.
    const heading = (await page.getByRole("heading", { level: 2 }).textContent()) ?? "";
    const question = answers.get(heading.trim());

    // oxlint-disable-next-line no-await-in-loop -- One answer, then the next question.
    await page
      .getByRole("radio", { name: question && knows(question) ? question.right : question?.wrong })
      .click();

    const next = page.getByRole("button", { name: "Next" });

    // oxlint-disable-next-line no-await-in-loop -- The section's last question has no Next.
    if (number === total || !(await next.isVisible())) {
      return;
    }

    // oxlint-disable-next-line no-await-in-loop -- Next shows the following question.
    await next.click();
  }
}

/** One question of the formats mock, by its heading: the quick ones right (`answers`). */
async function answerFormatQuestion({
  answers,
  heading,
  page,
}: {
  answers: Map<string, Question>;
  heading: string;
  page: Page;
}) {
  if (heading === FORMAT_ITEMS.picks.content.question) {
    // Only the first of its two right options: +1 of +4.
    await expect(page.getByText("Select all that apply.")).toBeVisible();
    await page.getByRole("checkbox", { name: "2 + 2 = 4" }).click();
    await expect(page.getByRole("checkbox", { name: "2 + 2 = 4" })).toBeChecked();
    return;
  }

  if (heading.startsWith("A pizza has")) {
    await expect(page.getByText("A fraction, like 2/3, or a decimal.")).toBeVisible();
    await page.getByLabel("Your answer").fill("2/3");
    return;
  }

  if (heading === FORMAT_ITEMS.word.content.question) {
    await page.getByLabel("Your answer").fill("prime");
    return;
  }

  await page.getByRole("radio", { name: answers.get(heading)?.right }).click();
}

/**
 * Answers the formats mock's questions in order (`FORMATS_STRUCTURE`): the quick ones, the fraction
 * and the word right, and only one of the two right options of the question with several picks.
 */
export async function answerFormatsMock({
  answers,
  page,
}: {
  answers: Map<string, Question>;
  page: Page;
}) {
  for (let number = 1; number <= FORMATS_QUESTIONS; number += 1) {
    // oxlint-disable-next-line no-await-in-loop -- A mock is answered one question at a time.
    await expect(page.getByText(new RegExp(`^Question ${number} of \\d+`, "u"))).toBeVisible();

    // oxlint-disable-next-line no-await-in-loop -- The question on screen decides the answer.
    const heading = ((await page.getByRole("heading", { level: 2 }).textContent()) ?? "").trim();

    // oxlint-disable-next-line no-await-in-loop -- One answer, then the next question.
    await answerFormatQuestion({ answers, heading, page });

    if (number < FORMATS_QUESTIONS) {
      // oxlint-disable-next-line no-await-in-loop -- Next shows the following question.
      await page.getByRole("button", { name: "Next" }).click();
    }
  }
}
