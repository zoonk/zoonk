import { prisma } from "@zoonk/db";
import { type MockShowing, showMockChoice } from "../exams/mocks/_utils/mock-items";
import { mockConditionsSchema } from "../exams/mocks/mock-contract";
import { type ChoiceItem, parseChoiceItem } from "../learner/_utils/choice-items";
import { getLearnerTimeZone } from "../learner/_utils/goal-time-zone";
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

type MistakeShowingInput = {
  /** When the learner sees it; defaults to now. */
  date?: Date;
  mistakeId: string;
  /** The zone the learner answers in; defaults to their active goal's, as practice reads it. */
  timeZone?: string;
};

async function showMistakeChoice({ date = new Date(), mistakeId, timeZone }: MistakeShowingInput) {
  const mistake = await prisma.mistake.findUniqueOrThrow({ where: { id: mistakeId } });

  const [replay, zone] = await Promise.all([
    loadMistakeReplay({ mistake, userId: mistake.userId }),
    getLearnerTimeZone({ timeZone, userId: mistake.userId }),
  ]);

  if (replay?.kind !== "item" || replay.item.format !== "multipleChoice") {
    throw new Error(`Mistake ${mistakeId} doesn't replay a multiple-choice question`);
  }

  const showing = getMistakeShowing({ date, mistakeId, timeZone: zone });
  return showChoiceInBlock({ blockId: showing, item: replay.item });
}

/** Where each option of a mistake's replay sits on the learner's day, as they see them. */
export async function shownMistakeOptions(input: MistakeShowingInput): Promise<string[]> {
  const shown = await showMistakeChoice(input);

  return shown.format === "multipleChoice"
    ? shown.content.options.map((option) => option.text)
    : [];
}

/** The answer a learner gives a mistake's replay by tapping the right option, or a wrong one, on that day. */
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
