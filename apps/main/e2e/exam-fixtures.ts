import { randomUUID } from "node:crypto";
import { type Page, expect } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { type Mode } from "./learn-personas";

/** Six questions keep a mock quick to play; the pace still follows the exam's. */
const MOCK_QUESTIONS = 6;
const PASS_MARK = 4;

/** An ENEM essay's scores by competency: strong, except the intervention proposal (C5). */
const STRONG = 160;
const GOOD = 140;
const WEAK = 80;
const ESSAY_SCORES = [STRONG, STRONG, GOOD, STRONG, WEAK];
const INTERVENTION_INDEX = 4;

async function findTodaySession({ goalId, userId }: { goalId: string; userId: string }) {
  return prisma.studySession.findFirstOrThrow({
    orderBy: { localDate: "desc" },
    where: { goalId, userId },
  });
}

type ChoiceOption = { isCorrect: boolean; text: string };

function isChoiceOption(value: unknown): value is ChoiceOption {
  return typeof value === "object" && value !== null && "isCorrect" in value && "text" in value;
}

function readQuestion(content: unknown): string {
  const question =
    content && typeof content === "object" && "question" in content ? content.question : "";

  return typeof question === "string" ? question : "";
}

/** The options of a bank item's multiple-choice content, each with whether it's right. */
export function readOptions(content: unknown): ChoiceOption[] {
  const options =
    content && typeof content === "object" && "options" in content ? content.options : [];

  return Array.isArray(options) ? options.filter((option) => isChoiceOption(option)) : [];
}

/**
 * Puts the week's mock in the persona's session today, with questions from the exam's own bank.
 * The mock asks those of one exam day. Returns the right and a wrong option of each question, so
 * a test can answer on purpose.
 */
export async function addTodayMock({ goalId, userId }: { goalId: string; userId: string }) {
  const [goal, session, seen] = await Promise.all([
    prisma.goal.findUniqueOrThrow({ where: { id: goalId } }),
    findTodaySession({ goalId, userId }),
    prisma.attempt.findMany({ select: { itemId: true }, where: { userId } }),
  ]);

  const seenIds = new Set(seen.flatMap((attempt) => (attempt.itemId ? [attempt.itemId] : [])));

  const bank = await prisma.item.findMany({
    orderBy: { id: "asc" },
    where: { examBlueprintId: goal.examBlueprintId, format: "multipleChoice" },
  });

  // Unseen questions first, as the builder picks them; the seeded bank is small, so seen ones fill in.
  const items = bank
    .toSorted((first, second) => Number(seenIds.has(first.id)) - Number(seenIds.has(second.id)))
    .slice(0, MOCK_QUESTIONS);

  const block = await studySessionBlockFixture({
    estimatedMinutes: 20,
    kind: "checkpoint",
    payload: {
      checkpoint: {
        kind: "weekly",
        mock: true,
        passMark: PASS_MARK,
        phase: 0,
        rematch: false,
        timeLimitMinutes: 20,
      },
      itemIds: items.map((item) => item.id),
      skillIds: [...new Set(items.map((item) => item.skillId))],
      title: "Mock exam",
    },
    sessionId: session.id,
  });

  const answers = new Map(
    items.map((item) => {
      const options = readOptions(item.content);

      return [
        readQuestion(item.content),
        {
          right: options.find((option) => option.isCorrect)?.text ?? "",
          wrong: options.find((option) => !option.isCorrect)?.text ?? "",
        },
      ] as const;
    }),
  );

  return { answers, blockId: block.id };
}

type MockAnswers = Awaited<ReturnType<typeof addTodayMock>>["answers"];

async function answerMockQuestion(
  page: Page,
  { answers, number, total }: { answers: MockAnswers; number: number; total: number },
) {
  await expect(page.getByText(new RegExp(`^Question ${number} of \\d+`, "u"))).toBeVisible();

  const heading = (await page.getByRole("heading", { level: 1 }).textContent()) ?? "";
  const answer = answers.get(heading.trim());
  const isFirst = number === 1;

  await page.getByRole("radio", { name: isFirst ? answer?.wrong : answer?.right }).click();

  if (isFirst) {
    await page.getByRole("button", { name: "Flag" }).click();
  }

  await page
    .getByRole("button", { name: number === total ? "Hand in the mock exam" : "Next" })
    .click();
}

/**
 * Plays a running mock from `addTodayMock`: the first question wrong and flagged as unsure, the
 * rest right, moving with Next until the last question hands the mock in. A mock asks one exam
 * day's questions, so the first question's counter says how many there are.
 */
export async function playMock({ answers, page }: { answers: MockAnswers; page: Page }) {
  const counter = await page.getByText(/^Question 1 of \d+/u).textContent();
  const total = Number(/of (?<total>\d+)/u.exec(counter ?? "")?.groups?.total ?? 0);

  for (let number = 1; number <= total; number += 1) {
    // oxlint-disable-next-line no-await-in-loop -- A mock is answered one question at a time.
    await answerMockQuestion(page, { answers, number, total });
  }
}

/**
 * A writing block already open in today's session, with one draft graded by ENEM's rubric: essays
 * are graded by a model, which tests don't call, so the grade is stored the way grading stores it.
 */
export async function addGradedEssay({ goalId, userId }: { goalId: string; userId: string }) {
  const [goal, session] = await Promise.all([
    prisma.goal.findUniqueOrThrow({ where: { id: goalId } }),
    findTodaySession({ goalId, userId }),
  ]);

  const essay = await prisma.item.findFirstOrThrow({
    where: { examBlueprintId: goal.examBlueprintId, format: "essay" },
  });

  const block = await studySessionBlockFixture({
    estimatedMinutes: 20,
    kind: "produce",
    payload: { itemIds: [essay.id], skillIds: [essay.skillId], title: "Essay" },
    sessionId: session.id,
    startedAt: new Date(),
    status: "active",
  });

  await prisma.attempt.create({
    data: {
      answer: {
        grade: {
          criteria: ESSAY_SCORES.map((score, index) => ({
            comment: `Comment on competency ${index + 1}.`,
            example: index === INTERVENTION_INDEX ? "por meio de campanhas nas escolas" : null,
            id: `c${index + 1}`,
            maxScore: 200,
            name: `C${index + 1}`,
            quote: null,
            score,
          })),
          enemInterventionElements: {
            action: true,
            agent: true,
            detail: false,
            effect: true,
            means: false,
          },
          nextStep: { criterionId: "c5", text: "Say by what means the proposal will work." },
          range: { high: 740, low: 660 },
          total: { maxScore: 1000, score: 700 },
          zeroReason: null,
        },
        text: "Meu primeiro rascunho da redação.",
      },
      durationMs: 600_000,
      hour: 12,
      isCorrect: true,
      itemId: essay.id,
      localDate: session.localDate,
      score: 0.7,
      skillId: essay.skillId,
      studySessionId: session.id,
      userId,
      weekday: session.localDate.getUTCDay(),
    },
  });

  return { blockId: block.id };
}

const NOTICE = { passage: "Julgue os itens a seguir.", sourceId: "notice" };

/** A Cebraspe-style exam: statements judged right or wrong, and a wrong answer cancels a right one. */
export const NET_SCORED_STRUCTURE = {
  formats: [{ citation: NOTICE, description: "Certo ou Errado", kind: "trueFalse", options: null }],
  mock: {
    adaptive: false,
    citations: [],
    order: null,
    scoring: { description: "A wrong answer cancels a right one.", method: "wrongCancelsRight" },
    sections: [],
    timeLimitMinutes: 180,
    totalQuestions: 120,
  },
  rules: [],
  subjects: [],
};

/** A true-or-false statement, named by its label so a test can find it. */
export function statement(label: string, isTrue: boolean) {
  return {
    context: null,
    isTrue,
    misconception: null,
    reason: "Because of the statute.",
    statement: `${label}: ${randomUUID()}`,
  };
}

/**
 * A learner preparing for an exam with `structure` whose day is mixed practice on three statements
 * (true, false, true), scored net when the exam cancels a right answer with a wrong one, as the
 * session builder scores it.
 */
export async function createStatementPracticeDay({
  mode,
  netScored,
  structure,
}: {
  mode: Mode;
  netScored: boolean;
  structure: object;
}) {
  const [user, skill, blueprint, lesson] = await Promise.all([
    createE2EUser(getBaseURL()),
    skillFixture({ name: `Administrative law ${randomUUID()}` }),
    examBlueprintFixture({ name: "Concurso Test", structure }),
    libraryLessonFixture({ title: "Tenure" }),
  ]);

  const goal = await goalFixture({
    examBlueprintId: blueprint.id,
    kind: "exam",
    timezone: "UTC",
    userId: user.id,
  });

  const plan = await planFixture({ goalId: goal.id });

  const [statements, session] = await Promise.all([
    Promise.all(
      [
        statement("First statement", true),
        statement("Second statement", false),
        statement("Third statement", true),
      ].map((content) => itemFixture({ content, format: "trueFalse", skillId: skill.id })),
    ),
    studySessionFixture({ goalId: goal.id, userId: user.id }),
    planItemFixture({ kind: "lesson", lessonId: lesson.id, planId: plan.id, position: 0 }),
    learningProfileFixture({
      activeGoalId: goal.id,
      experienceMode: mode,
      userId: user.id,
      ...(mode === "fun" ? { buddyKind: "zu" } : {}),
    }),
  ]);

  await studySessionBlockFixture({
    estimatedMinutes: 5,
    kind: "practice",
    payload: { itemIds: statements.map((item) => item.id), netScored, skillIds: [skill.id] },
    position: 0,
    sessionId: session.id,
  });

  return { user };
}

/** A Cebraspe-style exam's practice day: statements judged right or wrong, scored net. */
export function createNetScoredPracticeDay(mode: Mode) {
  return createStatementPracticeDay({ mode, netScored: true, structure: NET_SCORED_STRUCTURE });
}
