import { z } from "zod";
import {
  explanationSchema,
  idSchema,
  labelSchema,
  languageCodeSchema,
  optionTextSchema,
  uniqueIdsSchema,
} from "../../steps/contract/content-schemas";
import { aimForItems } from "../activity-schemas";
import { defineActivityTemplate } from "../define-activity-template";
import { patternEnding } from "./_utils/language";
import { duplicateIssues, issue } from "./_utils/template-helpers";

const CHOICES_TARGET = 6;
const ROWS_TARGET = 8;
const LINES_TARGET = 6;
const REPLIES_TARGET = 4;

const patternTableFields = z
  .object({
    choices: z.array(labelSchema).min(2).describe(aimForItems(CHOICES_TARGET)),
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
      .describe(aimForItems(ROWS_TARGET)),
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
        .describe(aimForItems(LINES_TARGET)),
      replies: uniqueIdsSchema(replySchema, { min: 2 }).describe(aimForItems(REPLIES_TARGET)),
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
