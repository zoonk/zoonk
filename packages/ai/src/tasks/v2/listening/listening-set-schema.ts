import { z } from "zod";
import { GENERATED_ITEM_SCHEMAS, type GeneratedItem } from "../items/item-schemas";

/** The formats a listening question is asked in: chosen, judged, or typed from what was heard. */
export const LISTENING_QUESTION_FORMATS = ["multipleChoice", "trueFalse", "typed"] as const;

export type ListeningQuestionFormat = (typeof LISTENING_QUESTION_FORMATS)[number];

/** Voices people hear apart in a conversation; code picks each speaker's voice from these. */
export const LISTENING_GENDERS = ["female", "male"] as const;

type ListeningGender = (typeof LISTENING_GENDERS)[number];

/** A listening question is about what was heard, so it never shows a chart or a picture. */
const NO_PICTURES = { image: true, visual: true } as const;

/** A listening question's options are always shuffled (`toListeningItem` stores them that way). */
const SHUFFLED = { ...NO_PICTURES, fixedOrder: true } as const;

/**
 * The words of the script that answer the question, copied exactly: code finds them in the script
 * to check the key, and the questions follow the order those words are heard in.
 */
const evidence = z.string();

/** The number of the skill (from the call's list, from 1) the question tests. */
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

/**
 * A listening question as the item bank stores it: without its evidence (the transcript shows the
 * words after answering) or its skill number (the item's skill), with no picture or chart, and with
 * options shuffled like every question whose order means nothing.
 */
export function toListeningItem(question: ListeningQuestion): GeneratedItem {
  return GENERATED_ITEM_SCHEMAS[question.format].parse({
    ...question,
    fixedOrder: false,
    image: null,
    visual: null,
  });
}

/**
 * The output schema for one call: the people speaking (each with an accent from the exam's list),
 * what each says in order, then the questions. Only the formats the task asks for are allowed.
 */
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

/** One speaker of a script as the writer describes them; code adds the voice. */
type ListeningSpeaker = { accent: string; gender: ListeningGender; name: string };

export type ListeningTurn = { speaker: string; text: string };

/** A listening set as written: the script and the questions on it, in the order they're heard. */
export type ListeningSet = {
  questions: ListeningQuestion[];
  speakers: ListeningSpeaker[];
  title: string;
  turns: ListeningTurn[];
};
