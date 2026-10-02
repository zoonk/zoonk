import { z } from "zod";
import {
  explanationSchema,
  idSchema,
  labelSchema,
  languageCodeSchema,
  optionTextSchema,
  promptSchema,
  uniqueIdsSchema,
} from "../../steps/contract/content-schemas";
import { defineActivityTemplate } from "../define-activity-template";
import { patternEnding, sentenceTiles, tileKey } from "./_utils/language";
import { duplicateIssues, issue } from "./_utils/template-helpers";

const MAX_VARIANTS = 4;
const MAX_DISTRACTORS = 4;
const MAX_CHOICES = 6;
const MAX_ROWS = 8;
const MAX_LINES = 6;
const MAX_REPLIES = 4;
const MAX_SCRIPT_LENGTH = 600;
const MIN_SPEED = 0.5;
const MAX_SPEED = 1.5;
const MAX_SPEEDS = 4;

function countTiles(tiles: readonly string[]): Map<string, number> {
  return tiles.reduce(
    (counts, tile) => counts.set(tileKey(tile), (counts.get(tileKey(tile)) ?? 0) + 1),
    new Map<string, number>(),
  );
}

function canBuild(sentence: string, available: ReadonlyMap<string, number>): boolean {
  return [...countTiles(sentenceTiles(sentence))].every(
    ([tile, count]) => (available.get(tile) ?? 0) >= count,
  );
}

const sentenceBuilderFields = z
  .object({
    acceptedVariants: z.array(optionTextSchema).max(MAX_VARIANTS),
    distractors: z
      .array(z.object({ why: explanationSchema, word: labelSchema }).strict())
      .min(1)
      .max(MAX_DISTRACTORS),
    language: languageCodeSchema,
    prompt: promptSchema,
    situation: explanationSchema,
    target: optionTextSchema,
  })
  .strict();

type SentenceBuilderFields = z.output<typeof sentenceBuilderFields>;

function sentenceBuilderIssues(fields: SentenceBuilderFields) {
  const targetTiles = sentenceTiles(fields.target);
  const targetKeys = new Set(targetTiles.map((tile) => tileKey(tile)));
  const distractorTiles = fields.distractors.map((item) => sentenceTiles(item.word));
  const available = countTiles([...targetTiles, ...distractorTiles.flat()]);

  return [
    targetTiles.length < 2 &&
      issue("missingInteraction", "fields.target", "A one-word sentence has nothing to build"),
    distractorTiles.some((tiles) => tiles.length !== 1) &&
      issue("inconsistentFields", "fields.distractors", "Each distractor must be one word"),
    distractorTiles.flat().some((tile) => targetKeys.has(tileKey(tile))) &&
      issue("inconsistentFields", "fields.distractors", "A distractor is part of the answer"),
    fields.acceptedVariants.some((variant) => !canBuild(variant, available)) &&
      issue(
        "inconsistentFields",
        "fields.acceptedVariants",
        "A variant can't be built from the tiles",
      ),
  ].filter((item) => item !== false);
}

export const sentenceBuilderTemplate = defineActivityTemplate({
  checks: ["interaction"],
  description:
    "Build a real sentence from word tiles, with distractors that test one choice, like inviting friends with vosotros. Tiles are the target's words without punctuation, plus the distractors (one word each); any accepted variant must use the same tiles, and case and punctuation don't count. Fills: the target language code, the situation, the prompt in the learner's language, the target sentence, accepted variants and distractors with why each is wrong.",
  expected: (fields) => ({ accepted: [fields.target, ...fields.acceptedVariants], kind: "text" }),
  fields: sentenceBuilderFields,
  id: "sentenceBuilder",
  needsData: false,
  verify: (fields) => sentenceBuilderIssues(fields),
});

const patternTableFields = z
  .object({
    choices: z.array(labelSchema).min(2).max(MAX_CHOICES),
    modelMeaning: labelSchema.optional(),
    modelWord: labelSchema,
    newMeaning: labelSchema.optional(),
    newWord: labelSchema,
    rows: z
      .array(
        z
          .object({
            answer: labelSchema,
            blank: z.boolean(),
            label: labelSchema,
            labelMeaning: labelSchema.optional(),
            model: labelSchema,
          })
          .strict(),
      )
      .min(2)
      .max(MAX_ROWS),
  })
  .strict();

export const patternTableTemplate = defineActivityTemplate({
  checks: ["interaction"],
  description:
    'See a full pattern for a model word, then complete it for a new word by choosing endings, like hablar to comer. Code finds each blank\'s ending from its answer (endings are written without a hyphen, like "éis"). Fills: the pattern rows, the model word, the new word, which cells are blank, the ending choices and, for a learner who reads another language, the meaning of each word and row label ("to speak", "I").',
  expected: (fields) => ({
    kind: "assignment",
    pairs: Object.fromEntries(
      fields.rows.flatMap((row, index) =>
        row.blank ? [[String(index), patternEnding(fields.choices, row.answer) ?? ""]] : [],
      ),
    ),
  }),
  fields: patternTableFields,
  id: "patternTable",
  needsData: false,
  verify: (fields) =>
    [
      ...duplicateIssues(fields.choices, "fields.choices", "Ending"),
      !fields.rows.some((row) => row.blank) &&
        issue("missingInteraction", "fields.rows", "No cell is left for the learner to complete"),
      fields.rows.some((row) => row.blank && patternEnding(fields.choices, row.answer) === null) &&
        issue(
          "answerMismatch",
          "fields.rows",
          "A blank's answer doesn't end with any offered ending",
        ),
      fields.rows.some(
        (row) => row.blank && patternEnding(fields.choices, row.answer) === row.answer,
      ) && issue("inconsistentFields", "fields.rows", "A blank's ending can't be its whole answer"),
    ].filter((item) => item !== false),
});

const replySchema = z
  .object({
    id: idSchema,
    isBest: z.boolean(),
    text: optionTextSchema,
    translation: optionTextSchema,
    why: explanationSchema,
  })
  .strict();

export const dialogueSimulatorTemplate = defineActivityTemplate({
  checks: ["interaction"],
  description:
    "Choose the reply that keeps a real conversation polite and natural, like using usted with a pharmacist. Exactly one reply is best. Fills: the target language code, the scene, each line with its translation, reply options, the best reply and the why for each.",
  expected: (fields) => ({
    ids: fields.replies.filter((reply) => reply.isBest).map((reply) => reply.id),
    kind: "selection",
  }),
  fields: z
    .object({
      language: languageCodeSchema,
      lines: z
        .array(
          z
            .object({
              speaker: z.enum(["them", "you"]),
              text: optionTextSchema,
              translation: optionTextSchema,
            })
            .strict(),
        )
        .min(1)
        .max(MAX_LINES),
      replies: uniqueIdsSchema(replySchema, { max: MAX_REPLIES, min: 2 }),
      scene: explanationSchema,
    })
    .strict(),
  id: "dialogueSimulator",
  needsData: false,
  verify: (fields) =>
    fields.replies.filter((reply) => reply.isBest).length === 1
      ? []
      : [issue("inconsistentFields", "fields.replies", "Exactly one reply must be the best")],
});

export const listeningSpeedTemplate = defineActivityTemplate({
  checks: ["choice"],
  description:
    "Slow real speech down and replay it, then answer before reading the words, like a friend's voice message. The transcript (the script) shows after answering. Fills: the script and voice, the question, answer options and the playback speeds (always including 1).",
  fields: z
    .object({
      language: languageCodeSchema,
      script: z.string().min(1).max(MAX_SCRIPT_LENGTH),
      speeds: z.array(z.number().min(MIN_SPEED).max(MAX_SPEED)).min(2).max(MAX_SPEEDS),
      voice: labelSchema.optional(),
    })
    .strict(),
  id: "listeningSpeed",
  needsData: false,
  verify: (fields) =>
    [
      ...duplicateIssues(fields.speeds.map(String), "fields.speeds", "Speed"),
      !fields.speeds.includes(1) &&
        issue("inconsistentFields", "fields.speeds", "Normal speed (1) must be one of the speeds"),
    ].filter((item) => item !== false),
});
