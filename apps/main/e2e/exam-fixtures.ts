import { randomUUID } from "node:crypto";
import { type Page, expect } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";

const MOCK_QUESTIONS = 6;
const PASS_MARK = 4;

const MOCK_PLAN_POSITION = 10_000;

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

function readOptions(content: unknown): ChoiceOption[] {
  const options =
    content && typeof content === "object" && "options" in content ? content.options : [];

  return Array.isArray(options) ? options.filter((option) => isChoiceOption(option)) : [];
}

export async function addTodayMock({ goalId, userId }: { goalId: string; userId: string }) {
  const [goal, session, seen, plan] = await Promise.all([
    prisma.goal.findUniqueOrThrow({ where: { id: goalId } }),
    findTodaySession({ goalId, userId }),
    prisma.attempt.findMany({ select: { itemId: true }, where: { userId } }),
    prisma.plan.findUniqueOrThrow({ where: { goalId } }),
  ]);

  const planItem = await planItemFixture({
    kind: "mock",
    phase: 0,
    planId: plan.id,
    position: MOCK_PLAN_POSITION,
    scheduledFor: session.localDate,
    titleSnapshot: "",
  });

  const seenIds = new Set(seen.flatMap((attempt) => (attempt.itemId ? [attempt.itemId] : [])));

  const bank = await prisma.item.findMany({
    orderBy: { id: "asc" },
    where: { examBlueprintId: goal.examBlueprintId, format: "multipleChoice" },
  });

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
        mockIdentity: { day: 2, fullLength: false },
        passMark: PASS_MARK,
        phase: 0,
        rematch: false,
        timeLimitMinutes: 20,
      },
      // This injected mock is extra work; Start keeps it when refreshing the scheduled queue.
      extra: true,
      itemIds: items.map((item) => item.id),
      planItemId: planItem.id,
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

  return { answers, blockId: block.id, planItemId: planItem.id };
}

type MockAnswers = Awaited<ReturnType<typeof addTodayMock>>["answers"];

async function handInMock(page: Page) {
  await page.getByRole("button", { name: "Hand in the mock exam" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Hand in" }).click();
}

async function answerMockQuestion(
  page: Page,
  { answers, number, total }: { answers: MockAnswers; number: number; total: number },
) {
  await expect(page.getByText(new RegExp(`^Question ${number} of \\d+`, "u"))).toBeVisible();

  const main = page.getByRole("main");
  const heading = (await main.getByRole("heading", { level: 2 }).textContent()) ?? "";
  const answer = answers.get(heading.trim());
  const isFirst = number === 1;

  await page.getByRole("radio", { name: isFirst ? answer?.wrong : answer?.right }).click();

  if (isFirst) {
    await page.getByRole("button", { name: "Flag" }).click();
  }

  if (number === total) {
    await handInMock(page);
    return;
  }

  await page.getByRole("button", { name: "Next" }).click();
}

export async function playMock({ answers, page }: { answers: MockAnswers; page: Page }) {
  const counter = await page.getByText(/^Question 1 of \d+/u).textContent();
  const total = Number(/of (?<total>\d+)/u.exec(counter ?? "")?.groups?.total ?? 0);

  for (let number = 1; number <= total; number += 1) {
    // oxlint-disable-next-line no-await-in-loop -- A mock is answered one question at a time.
    await answerMockQuestion(page, { answers, number, total });
  }
}

const ENEM_INSTRUCTION =
  "A partir da leitura dos textos motivadores e com base nos conhecimentos construídos ao longo de sua formação, redija texto dissertativo-argumentativo em modalidade escrita formal da língua portuguesa sobre o tema *Desafios para tornar clara a comunicação dos serviços públicos no Brasil*, apresentando proposta de intervenção que respeite os direitos humanos. Selecione, organize e relacione, de forma coerente e coesa, argumentos e fatos para defesa de seu ponto de vista.";

export async function createEnemEssayDay() {
  const [user, skill, blueprint] = await Promise.all([
    createE2EUser(getBaseURL()),
    skillFixture({ name: `Public communication ${randomUUID()}` }),
    examBlueprintFixture({ identityKey: `enem-${randomUUID()}`, name: "ENEM" }),
  ]);

  const goal = await goalFixture({
    examBlueprintId: blueprint.id,
    kind: "exam",
    timezone: "UTC",
    title: "ENEM",
    userId: user.id,
  });

  const [item, session] = await Promise.all([
    itemFixture({
      content: {
        context: "Tema: Desafios para tornar clara a comunicação dos serviços públicos no Brasil.",
        keyPoints: ["An intervention proposal with agent, action, means, purpose and a detail"],
        question: ENEM_INSTRUCTION,
        rubric: [
          { criterion: "C1", description: "Formal writing", points: null },
          { criterion: "C5", description: "Intervention proposal", points: null },
        ],
        sampleOutline: "Thesis, two arguments, an intervention proposal.",
      },
      examBlueprintId: blueprint.id,
      format: "essay",
      skillId: skill.id,
    }),
    studySessionFixture({ goalId: goal.id, userId: user.id }),
    planFixture({ goalId: goal.id }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
  ]);

  const block = await studySessionBlockFixture({
    estimatedMinutes: 20,
    kind: "produce",
    payload: { itemIds: [item.id], skillIds: [skill.id], title: "Essay" },
    sessionId: session.id,
    startedAt: new Date(),
    status: "active",
  });

  return { blockId: block.id, goalId: goal.id, user };
}

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
          total: { maxScore: 1000, score: ESSAY_SCORES.reduce((sum, score) => sum + score, 0) },
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
