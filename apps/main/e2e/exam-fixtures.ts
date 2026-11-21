import { randomUUID } from "node:crypto";
import { type Page, expect } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { typesetNumbers } from "@zoonk/learn/rich-text/typography";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { z } from "zod";
import { answerForMockHeading } from "./anytime-mock-fixtures";

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

const LOWERCASE_A_CODE_POINT = 97;

/** Letters only: the question's text typesets digit runs, which would change its lookup key. */
function letterId() {
  return randomUUID().replaceAll(/\d/gu, (digit) =>
    String.fromCodePoint(LOWERCASE_A_CODE_POINT + Number(digit)),
  );
}

const RESERVE_PER_AREA = 45;

const planSkillsSchema = z.object({
  skills: z.array(z.object({ area: z.string().nullish(), skillId: z.string().nullish() })),
});

async function fillMockReserve({
  examBlueprintId,
  graph,
}: {
  examBlueprintId: string | null;
  graph: unknown;
}) {
  const { skills } = planSkillsSchema.parse(graph);

  const templates = await prisma.item.findMany({
    orderBy: { id: "asc" },
    where: { examBlueprintId, format: "multipleChoice", mockOnly: false },
  });

  const areas = Map.groupBy(
    skills.flatMap(({ area, skillId }) => (skillId ? [{ area, skillId }] : [])),
    ({ area }) => area,
  );

  return Promise.all(
    [...areas.values()].flatMap((areaSkills) =>
      Array.from({ length: RESERVE_PER_AREA }, (_, index) => {
        const skillId = areaSkills[index % areaSkills.length]?.skillId ?? "";
        const template = templates[index % templates.length]?.content ?? {};
        const question = `Mock question ${letterId()}?`;

        return itemFixture({
          content: Object.fromEntries([...Object.entries(template), ["question", question]]),
          examBlueprintId,
          mockOnly: true,
          skillId,
        });
      }),
    ),
  );
}

export async function addTodayMock({ goalId, userId }: { goalId: string; userId: string }) {
  const [goal, session, plan] = await Promise.all([
    prisma.goal.findUniqueOrThrow({ where: { id: goalId } }),
    findTodaySession({ goalId, userId }),
    prisma.plan.findUniqueOrThrow({ where: { goalId } }),
  ]);

  const [planItem, items] = await Promise.all([
    planItemFixture({
      kind: "mock",
      phase: 0,
      planId: plan.id,
      position: MOCK_PLAN_POSITION,
      scheduledFor: session.localDate,
      titleSnapshot: "",
    }),
    fillMockReserve({ examBlueprintId: goal.examBlueprintId, graph: plan.graph }),
  ]);

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
      itemIds: [],
      planItemId: planItem.id,
      skillIds: [...new Set(items.map((item) => item.skillId))],
      title: "Mock exam",
    },
    sessionId: session.id,
  });

  // Earlier runs may have left questions in the shared reserve, so every one of them gets an answer.
  const reserve = await prisma.item.findMany({
    where: { examBlueprintId: goal.examBlueprintId, format: "multipleChoice", mockOnly: true },
  });

  const answers = new Map(
    reserve.map((item) => {
      const options = readOptions(item.content);

      return [
        readQuestion(item.content),
        {
          right: typesetNumbers({
            group: false,
            locale: "en",
            text: options.find((option) => option.isCorrect)?.text ?? "",
          }),
          wrong: typesetNumbers({
            group: false,
            locale: "en",
            text: options.find((option) => !option.isCorrect)?.text ?? "",
          }),
        },
      ] as const;
    }),
  );

  return { answers, blockId: block.id, planItemId: planItem.id };
}

type MockAnswers = Awaited<ReturnType<typeof addTodayMock>>["answers"];

const UNSURE_TIP = "Check it again before you hand in. Your result shows how these answers went.";

async function handInMock(page: Page) {
  const sheet = page.getByRole("complementary", { name: "Answer sheet" });

  await expect(sheet.getByRole("button", { name: "Question 2, not sure" })).toBeVisible();
  await expect(sheet.getByText("2 not sure")).toBeVisible();
  await sheet.getByRole("button", { name: "Hand in" }).click();

  const dialog = page.getByRole("alertdialog");

  await expect(dialog).toContainText("You're not sure of 2 answers.");
  await dialog.getByRole("button", { name: "Hand in" }).click();
}

async function markUnsure(page: Page, { firstPress }: { firstPress: boolean }) {
  const button = page.getByRole("button", { exact: true, name: "Not sure" });

  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");

  await expect(page.getByText(UNSURE_TIP)).toBeVisible({ visible: firstPress });
}

/** Coming back to the question the tip opened on doesn't show it again: only a press does. */
async function revisitFirstQuestion(page: Page) {
  const sheet = page.getByRole("complementary", { name: "Answer sheet" });

  await expect(page.getByText(UNSURE_TIP)).toBeHidden();
  await sheet.getByRole("button", { name: "Question 1, not sure" }).click();
  await expect(page.getByText(/^Question 1 of \d+/u)).toBeVisible();
  await expect(page.getByText(UNSURE_TIP)).toBeHidden();
  await sheet.getByRole("button", { exact: true, name: "Question 2" }).click();
  await expect(page.getByText(/^Question 2 of \d+/u)).toBeVisible();
}

async function answerMockQuestion(
  page: Page,
  { answers, number, total }: { answers: MockAnswers; number: number; total: number },
) {
  await expect(page.getByText(new RegExp(`^Question ${number} of \\d+`, "u"))).toBeVisible();

  if (number === 2) {
    await revisitFirstQuestion(page);
  }

  const main = page.getByRole("main");
  const heading = (await main.getByRole("heading", { level: 2 }).textContent()) ?? "";
  const answer = answerForMockHeading({ answers, heading });
  const isFirst = number === 1;

  await page.getByRole("radio", { name: isFirst ? answer.wrong : answer.right }).click();

  if (number <= 2) {
    await markUnsure(page, { firstPress: isFirst });
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
