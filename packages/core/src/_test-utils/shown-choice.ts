import { prisma } from "@zoonk/db";
import { type MockShowing, showMockChoice } from "../exams/mocks/_utils/mock-items";
import { mockConditionsSchema } from "../exams/mocks/mock-contract";
import { showLevelTestOptions } from "../language/level-test/_utils/level-test-shown-order";
import { type ChoiceItem, parseChoiceItem } from "../learner/_utils/choice-items";
import { getPlacementBlockId } from "../learner/placement/_utils/placement-items";
import { getMistakeShowing } from "../mistakes/mistake-item";
import { loadMistakeReplay } from "../mistakes/mistake-replay";
import { showChoiceInBlock } from "../sessions/_utils/session-items";

type ChoiceRow = Parameters<typeof parseChoiceItem>[0];

function parseMultipleChoice(row: ChoiceRow): ChoiceItem {
  const item = parseChoiceItem(row);

  if (item?.format !== "multipleChoice") {
    throw new Error(`Item ${row.id} isn't a multiple-choice item`);
  }

  return item;
}

function pickIn(shown: ChoiceItem, right: boolean): { selectedIndex: number } {
  const options = shown.format === "multipleChoice" ? shown.content.options : [];
  return { selectedIndex: options.findIndex((option) => option.isCorrect === right) };
}

/** Where each option sits in a block (or a showing passed as its block id), as the learner sees them. */
export function shownOptionTexts({ blockId, item }: { blockId: string; item: ChoiceRow }) {
  const shown = showChoiceInBlock({ blockId, item: parseMultipleChoice(item) });

  return shown.format === "multipleChoice"
    ? shown.content.options.map((option) => option.text)
    : [];
}

/** The answer a learner gives by tapping the right option, or a wrong one, where the block shows it. */
export function pickInBlock({
  blockId,
  item,
  right = true,
}: {
  blockId: string;
  item: ChoiceRow;
  right?: boolean;
}): { selectedIndex: number } {
  return pickIn(showChoiceInBlock({ blockId, item: parseMultipleChoice(item) }), right);
}

/** Like `pickInBlock`, for an item the test only knows by id. */
export async function pickItemInBlock({
  blockId,
  itemId,
  right = true,
}: {
  blockId: string;
  itemId: string;
  right?: boolean;
}): Promise<{ selectedIndex: number }> {
  const item = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });
  return pickInBlock({ blockId, item, right });
}

/** The answer a learner gives by tapping the right option, or a wrong one, where a mock shows it. */
function pickInMock({
  item,
  mock,
  right = true,
}: {
  item: ChoiceRow;
  mock: MockShowing;
  right?: boolean;
}): { selectedIndex: number } {
  return pickIn(showMockChoice({ item: parseMultipleChoice(item), mock }), right);
}

/** Like `pickInMock`, for a saved mock known by its id or its block's (as `getMock` takes either). */
export async function pickItemInMock({
  itemId,
  mockId,
  right = true,
}: {
  itemId: string;
  mockId: string;
  right?: boolean;
}): Promise<{ selectedIndex: number }> {
  const [item, sitting] = await Promise.all([
    prisma.item.findUniqueOrThrow({ where: { id: itemId } }),
    prisma.mockExam.findFirstOrThrow({ where: { OR: [{ id: mockId }, { blockId: mockId }] } }),
  ]);

  const conditions = mockConditionsSchema.parse(sitting.conditions);
  return pickInMock({ item, mock: { conditions, id: sitting.id }, right });
}

type MistakeShowingInput = { mistakeId: string };

async function showMistakeChoice({ mistakeId }: MistakeShowingInput) {
  const mistake = await prisma.mistake.findUniqueOrThrow({ where: { id: mistakeId } });
  const replay = await loadMistakeReplay({ mistake, userId: mistake.userId });

  if (replay?.kind !== "item" || replay.item.format !== "multipleChoice") {
    throw new Error(`Mistake ${mistakeId} doesn't replay a multiple-choice question`);
  }

  return showChoiceInBlock({ blockId: getMistakeShowing(mistake), item: replay.item });
}

/** Where each option of a mistake's replay sits until its next miss, as the learner sees them. */
export async function shownMistakeOptions(input: MistakeShowingInput): Promise<string[]> {
  const shown = await showMistakeChoice(input);

  return shown.format === "multipleChoice"
    ? shown.content.options.map((option) => option.text)
    : [];
}

/** The answer a learner gives a mistake's replay by tapping the right option, or a wrong one, as it's shown now. */
export async function pickInMistake({
  right = true,
  ...input
}: MistakeShowingInput & { right?: boolean }): Promise<{ selectedIndex: number }> {
  return pickIn(await showMistakeChoice(input), right);
}

/** The tap a learner gives a placement or test-out question (shown in a context of its own) known by id. */
export async function pickInPlacement({
  itemId,
  right = true,
}: {
  itemId: string;
  right?: boolean;
}): Promise<{ selectedIndex: number }> {
  const item = parseMultipleChoice(await prisma.item.findUniqueOrThrow({ where: { id: itemId } }));
  return pickIn(showChoiceInBlock({ blockId: getPlacementBlockId(item), item }), right);
}

const LEVEL_TEST_OPTIONS = 4;

/** Where a level test attempt (or a goal's first test, without one) shows the bank option at `answerIndex`. */
export function tapInLevelTest({
  answerIndex,
  attemptId,
  count = LEVEL_TEST_OPTIONS,
  goalId,
  questionId,
}: {
  answerIndex: number;
  attemptId?: string;
  count?: number;
  goalId: string;
  questionId: string;
}): number {
  const options = Array.from({ length: count }, (_, index) => String(index));
  const question = { id: questionId, options };
  return showLevelTestOptions({ attemptId, goalId, question }).indexOf(String(answerIndex));
}
