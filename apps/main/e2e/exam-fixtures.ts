import { type Page, expect } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { typesetNumbers } from "@zoonk/learn/rich-text/typography";
import { planItemFixture } from "@zoonk/testing/fixtures/goals";
import { studySessionBlockFixture } from "@zoonk/testing/fixtures/study-sessions";
import { answerForMockHeading } from "./anytime-mock-fixtures";

const MOCK_QUESTIONS = 6;
const PASS_MARK = 4;

const MOCK_PLAN_POSITION = 10_000;

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

async function handInMock(page: Page) {
  await page
    .getByRole("complementary", { name: "Answer sheet" })
    .getByRole("button", { name: "Hand in" })
    .click();

  await page.getByRole("alertdialog").getByRole("button", { name: "Hand in" }).click();
}

async function answerMockQuestion(
  page: Page,
  { answers, number, total }: { answers: MockAnswers; number: number; total: number },
) {
  await expect(page.getByText(new RegExp(`^Question ${number} of \\d+`, "u"))).toBeVisible();

  const main = page.getByRole("main");
  const heading = (await main.getByRole("heading", { level: 2 }).textContent()) ?? "";
  const answer = answerForMockHeading({ answers, heading });
  const isFirst = number === 1;

  await page.getByRole("radio", { name: isFirst ? answer.wrong : answer.right }).click();

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
