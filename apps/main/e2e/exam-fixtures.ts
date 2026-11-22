import { randomUUID } from "node:crypto";
import { type Page, expect } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { typesetNumbers } from "@zoonk/learn/rich-text/typography";
import { planItemFixture } from "@zoonk/testing/fixtures/goals";
import { itemFixture } from "@zoonk/testing/fixtures/skills";
import { studySessionBlockFixture } from "@zoonk/testing/fixtures/study-sessions";
import { z } from "zod";
import { answerForMockHeading } from "./anytime-mock-fixtures";

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
