import { z } from "zod";
import {
  explanationSchema,
  labelSchema,
  partSchema,
  pictureRequestSchema,
} from "../../steps/contract/content-schemas";
import { aimForItems } from "../activity-schemas";
import { defineActivityTemplate } from "../define-activity-template";
import { duplicateIssues, issue } from "./_utils/template-helpers";

const PARTS_TARGET = 6;
const DISTRACTORS_TARGET = 3;
const MIX_UPS_TARGET = 4;

const labeledDiagramFields = z
  .object({
    distractors: z.array(labelSchema).describe(aimForItems(DISTRACTORS_TARGET)),
    mixUps: z
      .array(
        z.object({ feedback: explanationSchema, labels: z.array(labelSchema).length(2) }).strict(),
      )
      .describe(aimForItems(MIX_UPS_TARGET)),
    parts: z
      .array(z.object({ label: labelSchema, part: partSchema }).strict())
      .min(2)
      .describe(aimForItems(PARTS_TARGET)),
    picture: pictureRequestSchema,
  })
  .strict();

type LabeledDiagramFields = z.output<typeof labeledDiagramFields>;

export function spotNumber(index: number): string {
  return String(index + 1);
}

export function labeledPictureRequest(fields: LabeledDiagramFields) {
  return { ...fields.picture, parts: fields.parts.map((part) => part.part) };
}

function labeledDiagramIssues(fields: LabeledDiagramFields) {
  const labels = fields.parts.map((part) => part.label);
  const names = new Set([...labels, ...fields.distractors]);

  return [
    ...duplicateIssues(
      fields.parts.map((part) => part.part.toLowerCase()),
      "fields.parts",
      "Part",
    ),
    ...duplicateIssues([...labels, ...fields.distractors], "fields.parts", "Label"),
    ...fields.mixUps
      .filter((mixUp) => mixUp.labels.some((label) => !names.has(label)))
      .map(() =>
        issue("inconsistentFields", "fields.mixUps", "A mix-up names a label that isn't offered"),
      ),
  ];
}

export const labeledDiagramTemplate = defineActivityTemplate({
  checks: ["interaction"],
  description:
    "Put names on the numbered parts of one picture, like the chambers of the heart or the parts of a flower: code draws the whole once (`picture`: what it shows, with no words in it, and its alt text) with a number on each part, 1 for the first in `parts`, and the learner matches each number with its name. The parts are pieces of one whole, never separate things. Fills: the picture, the parts in order (each with its name in the lesson's language and, in English, the part its number marks), distractor names and feedback for each likely mix-up.",
  expected: (fields) => ({
    kind: "assignment",
    pairs: Object.fromEntries(fields.parts.map((part, index) => [spotNumber(index), part.label])),
  }),
  fields: labeledDiagramFields,
  id: "labeledDiagram",
  needsData: false,
  verify: (fields) => labeledDiagramIssues(fields),
});
