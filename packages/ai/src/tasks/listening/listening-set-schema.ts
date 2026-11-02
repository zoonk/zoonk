import { z } from "zod";
import { GENERATED_ITEM_SCHEMAS, type GeneratedItem } from "../items/item-schemas";

export const LISTENING_QUESTION_FORMATS = ["multipleChoice", "trueFalse", "typed"] as const;

export type ListeningQuestionFormat = (typeof LISTENING_QUESTION_FORMATS)[number];

/** Code picks each speaker's voice by these. */
export const LISTENING_GENDERS = ["female", "male"] as const;

type ListeningGender = (typeof LISTENING_GENDERS)[number];

/** A listening question is about what was heard, so it never shows a chart or a picture. */
const NO_PICTURES = { image: true, visual: true } as const;

/** A listening question's options are always shuffled (`toListeningItem` stores them that way). */
const SHUFFLED = { ...NO_PICTURES, fixedOrder: true } as const;

/** Copied exactly: code finds them in the script to check the key and order the questions. */
const evidence = z.string();

/** From the call's list, from 1. */
const skill = z.number().int();

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: the evidence comes before the question written from it. */
const LISTENING_QUESTION_SCHEMAS = {
  multipleChoice: z.object({
    evidence,
    skill,
    ...GENERATED_ITEM_SCHEMAS.multipleChoice.omit(SHUFFLED).shape,
  }),
  trueFalse: z.object({
    evidence,
    skill,
    ...GENERATED_ITEM_SCHEMAS.trueFalse.omit(NO_PICTURES).shape,
  }),
  typed: z.object({ evidence, skill, ...GENERATED_ITEM_SCHEMAS.typed.omit(NO_PICTURES).shape }),
} as const satisfies Record<ListeningQuestionFormat, z.ZodType>;

export type ListeningQuestion = z.infer<
  (typeof LISTENING_QUESTION_SCHEMAS)[ListeningQuestionFormat]
>;

export function toListeningItem(question: ListeningQuestion): GeneratedItem {
  return GENERATED_ITEM_SCHEMAS[question.format].parse({
    ...question,
    fixedOrder: false,
    image: null,
    visual: null,
  });
}

/** Only the formats the task asks for are allowed. */
export function buildListeningSetSchema({
  accents,
  formats,
}: {
  /** The accents a speaker may have; null for any (the writer names the exam's own). */
  accents: readonly [string, ...string[]] | null;
  formats: readonly [ListeningQuestionFormat, ...ListeningQuestionFormat[]];
}) {
  const [first, ...rest] = formats.map((format) => LISTENING_QUESTION_SCHEMAS[format]);
  const question = first && rest.length > 0 ? z.union([first, ...rest]) : first;

  if (!question) {
    throw new Error("A listening set needs at least one question format.");
  }

  return z.object({
    title: z.string(),
    speakers: z
      .array(
        z.object({
          name: z.string(),
          gender: z.enum(LISTENING_GENDERS),
          accent: accents ? z.enum(accents) : z.string(),
        }),
      )
      .min(1),
    turns: z.array(z.object({ speaker: z.string(), text: z.string() })).min(1),
    questions: z.array(question),
  });
}
/* oxlint-enable eslint/sort-keys */

/** Code adds the voice. */
type ListeningSpeaker = { accent: string; gender: ListeningGender; name: string };

export type ListeningTurn = { speaker: string; text: string };

export type ListeningSet = {
  questions: ListeningQuestion[];
  speakers: ListeningSpeaker[];
  title: string;
  turns: ListeningTurn[];
};
