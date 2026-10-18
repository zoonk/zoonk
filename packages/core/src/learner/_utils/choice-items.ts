import { type Item, type ItemFormat, type MediaAsset } from "@zoonk/db";
import { logError } from "@zoonk/utils/logger";
import { type ParsedItemContent, parseItemContent } from "../../library/items/item-content";
import { type ItemImage, toItemImage } from "../../library/items/item-image";
import { type ItemSetView } from "../../library/items/item-set-view";
import { toItemSetView } from "../../library/items/item-sets";
import { gradeOptionPicks } from "../../library/items/option-picks";
import { type MistakeSnapshot, withMistakeStimulus } from "../../mistakes/mistake-snapshot";
import { type ChoiceAnswer } from "../contract";

/**
 * Formats graded here on the server: one right option, or a true or false statement. Placement,
 * test-outs, mocks and "Practice mistakes" ask only these; session blocks also ask match pairs and
 * math problems with fresh numbers (`sessions/_utils/session-items`).
 */
export const GRADABLE_ITEM_FORMATS = [
  "multipleChoice",
  "trueFalse",
] as const satisfies ItemFormat[];

type ChoiceContent = Extract<ParsedItemContent, { format: (typeof GRADABLE_ITEM_FORMATS)[number] }>;

/** A bank question with the picture it shows, when it's about one. */
export type ChoiceItem = Pick<Item, "id" | "language" | "skillId"> &
  ChoiceContent & { image: ItemImage | null; set?: ItemSetView | null };

/**
 * A bank item as reads return it. Reads that show questions include its picture's file
 * (`ITEM_IMAGE_INCLUDE`) and its set (`ITEM_SET_INCLUDE`), including reads that save a mistake.
 */
export type BankItem = Pick<Item, "content" | "format" | "id" | "language" | "skillId"> & {
  mediaAsset?: Pick<MediaAsset, "height" | "url" | "width"> | null;
  set?: Parameters<typeof toItemSetView>[0]["item"]["set"];
  setPosition?: number | null;
};

function isGradableFormat(format: ItemFormat): format is ChoiceContent["format"] {
  return GRADABLE_ITEM_FORMATS.some((gradable) => gradable === format);
}

/**
 * Reads a bank item as a choice question, or null when it isn't one. Stored content passed the
 * item checks, so a parse failure is logged and the item skipped instead of failing the learner.
 */
export function parseChoiceItem(item: BankItem): ChoiceItem | null {
  if (!isGradableFormat(item.format)) {
    return null;
  }

  try {
    const parsed = parseItemContent({ content: item.content, format: item.format });

    return parsed.format === "multipleChoice" || parsed.format === "trueFalse"
      ? {
          ...parsed,
          id: item.id,
          image: toItemImage({ content: parsed.content, mediaAsset: item.mediaAsset }),
          language: item.language,
          set: item.set
            ? toItemSetView({ item: { set: item.set, setPosition: item.setPosition ?? null } })
            : null,
          skillId: item.skillId,
        }
      : null;
  } catch (error) {
    logError(`Item ${item.id} has content that doesn't match its format.`, error);
    return null;
  }
}

/** The question as the learner sees it: never which answer is right or why. */
export function toQuestionView(item: ChoiceItem) {
  const base = {
    context: item.content.context,
    image: item.image,
    itemId: item.id,
    skillId: item.skillId,
    visual: item.content.visual,
  };

  if (item.format === "trueFalse") {
    return { ...base, format: item.format, options: null, question: item.content.statement };
  }

  return {
    ...base,
    format: item.format,
    options: item.content.options.map((option) => option.text),
    question: item.content.question,
    /** How many options the learner picks: one, an exact number, or every right one ("all"). */
    select: item.content.select,
  };
}

export type QuestionView = ReturnType<typeof toQuestionView>;

/** Whether a question is answered with one pick: a statement, or one right option. */
export function isSinglePick(item: ChoiceItem): boolean {
  return item.format === "trueFalse" || item.content.select === 1;
}

/** The indexes of a multiple-choice question's right options. */
function getRightIndexes(options: readonly { isCorrect: boolean }[]): number[] {
  return options.flatMap((option, index) => (option.isCorrect ? [index] : []));
}

/** The right answer in the shape the learner answers with, shown after grading. */
export function getChoiceCorrectAnswer(
  item: ChoiceItem,
): { isTrue: boolean } | { selectedIndex: number } | { selectedIndexes: number[] } {
  if (item.format === "trueFalse") {
    return { isTrue: item.content.isTrue };
  }

  const right = getRightIndexes(item.content.options);
  return isSinglePick(item) ? { selectedIndex: right[0] ?? -1 } : { selectedIndexes: right };
}

/** The question text, for how long reading it takes and for the notebook. */
export function getQuestionText(item: ChoiceItem): string {
  return item.format === "trueFalse" ? item.content.statement : item.content.question;
}

/** Whether a wrong answer is tagged with a misconception, which trap drills look for. */
export function hasMisconceptions(item: ChoiceItem): boolean {
  if (item.format === "trueFalse") {
    return Boolean(item.content.misconception);
  }

  return item.content.options.some((option) => !option.isCorrect && Boolean(option.misconception));
}

type GradedChoice = {
  dontKnow: boolean;
  isCorrect: boolean;
  /** What the notebook keeps when the answer is wrong. */
  snapshot: MistakeSnapshot;
};

function gradeTrueFalse({
  answer,
  item,
}: {
  answer: ChoiceAnswer;
  item: Extract<ChoiceItem, { format: "trueFalse" }>;
}): GradedChoice {
  const picked = "isTrue" in answer ? answer.isTrue : null;
  const isCorrect = picked === item.content.isTrue;

  return {
    dontKnow: "dontKnow" in answer,
    isCorrect,
    snapshot: {
      answer: picked === null ? null : String(picked),
      correctAnswer: String(item.content.isTrue),
      explanation: item.content.reason,
      format: item.format,
      misconception: isCorrect || picked === null ? null : item.content.misconception,
      question: item.content.statement,
    },
  };
}

function getPicks(answer: ChoiceAnswer): number[] {
  if ("selectedIndex" in answer) {
    return [answer.selectedIndex];
  }

  return "selectedIndexes" in answer ? [...new Set(answer.selectedIndexes)] : [];
}

function joinTexts(options: readonly { text: string }[]): string | null {
  return options.length > 0 ? options.map((option) => option.text).join("; ") : null;
}

/**
 * Why a multiple-choice answer went the way it did: a right answer's picks say why they're right;
 * a miss says what went wrong, each wrong pick and each right option left unpicked, not the right
 * picks the learner already has (several reasons in a row would repeat what they share).
 */
function explainPicks({
  isCorrect,
  missed,
  picked,
}: {
  isCorrect: boolean;
  missed: readonly { isCorrect: boolean; reason: string }[];
  picked: readonly { isCorrect: boolean; reason: string }[];
}): string | null {
  const explained = isCorrect
    ? picked
    : [...picked.filter((option) => !option.isCorrect), ...missed];

  const reasons = explained.map((option) => option.reason);
  return reasons.length > 0 ? reasons.join(" ") : null;
}

/**
 * Grades the options picked against the right ones (`gradeOptionPicks`): one pick for a question
 * with one right option, every right option and nothing else for one that asks for several.
 */
function gradeMultipleChoice({
  answer,
  item,
}: {
  answer: ChoiceAnswer;
  item: Extract<ChoiceItem, { format: "multipleChoice" }>;
}): GradedChoice {
  const { options } = item.content;
  const picks = getPicks(answer);
  const graded = gradeOptionPicks({ options, picked: picks });
  const picked = picks.flatMap((index) => options[index] ?? []);
  const missed = options.filter((option, index) => option.isCorrect && !picks.includes(index));
  const trap = picked.find((option) => !option.isCorrect);

  return {
    dontKnow: "dontKnow" in answer,
    isCorrect: picks.length > 0 && graded.isCorrect,
    snapshot: {
      answer: joinTexts(picked),
      correctAnswer: joinTexts(options.filter((option) => option.isCorrect)),
      explanation: explainPicks({ isCorrect: graded.isCorrect, missed, picked }),
      format: item.format,
      misconception: trap?.misconception ?? null,
      question: item.content.question,
    },
  };
}

/**
 * Grades a choice answer. An option index past the list, a pick count other than the question
 * asks for, or an answer shape for the other format, counts as wrong, like any wrong pick.
 */
export function gradeChoiceAnswer({ answer, item }: { answer: ChoiceAnswer; item: ChoiceItem }) {
  const graded =
    item.format === "trueFalse"
      ? gradeTrueFalse({ answer, item })
      : gradeMultipleChoice({ answer, item });

  return {
    ...graded,
    snapshot: withMistakeStimulus({
      snapshot: graded.snapshot,
      stimulus: {
        context: item.content.context,
        image: item.image,
        set: item.set,
        visual: item.content.visual,
      },
    }),
  };
}
