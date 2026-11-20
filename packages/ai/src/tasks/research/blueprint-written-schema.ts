import { z } from "zod";
import { cited, citedMany } from "./cited-passages";

const zeroRuleKind = z.enum([
  "blank",
  "offTopic",
  "wrongForm",
  "tooFewLines",
  "copiedSupport",
  "identification",
  "other",
]);

type ZeroRuleKind = Exclude<z.infer<typeof zeroRuleKind>, "other">;

const writtenRuleSchema = z.object({ ...cited, text: z.string() });

const writtenGradingSchema = z.object({
  criteria: z.array(
    writtenRuleSchema.extend({
      id: z.string().describe("For Enem, c1 through c5 in the official competence order"),
      points: z.number().nullable(),
    }),
  ),
  kind: z.enum(["enem", "oab", "points", "levels"]),
  language: writtenRuleSchema
    .extend({
      factor: z.number().nullable(),
      formula: z.string().nullable(),
      method: z.enum(["perError", "errorsPerLine", "other"]),
    })
    .nullable(),
  rounding: writtenRuleSchema.nullable(),
  zeroing: z.array(
    writtenRuleSchema.extend({
      kinds: z
        .array(zeroRuleKind)
        .describe(
          "Each independent trigger in the cited rule. Other covers conduct, handwriting and any case a typed answer cannot establish.",
        ),
      maxLines: z
        .int()
        .positive()
        .nullable()
        .describe(
          "The largest number of original lines that earns zero, when the notice gives one",
        ),
    }),
  ),
});

export const writtenTaskSchema = z.object({
  ...citedMany,
  count: z.number().int(),
  description: z.string(),
  grading: writtenGradingSchema.nullable(),
  handwritten: z.boolean().nullable(),
  lines: z.int().nullable(),
  officialIdentifier: z.string().nullable(),
  plays: z.number().int().nullable(),
  points: z.number().nullable(),
});

type StoredRule = { citation: { passage: string; sourceId: string }; text: string };

type StoredWritingGrading = {
  criteria: (StoredRule & { id: string; points: number | null })[];
  kind: z.infer<typeof writtenGradingSchema>["kind"];
  language:
    | (StoredRule &
        Omit<
          NonNullable<z.infer<typeof writtenGradingSchema>["language"]>,
          "document" | "passage" | "text"
        >)
    | null;
  rounding: StoredRule | null;
  zeroing: (StoredRule & { kinds?: ZeroRuleKind[]; maxLines?: number | null })[];
};

export type WrittenTask = Pick<
  z.infer<typeof writtenTaskSchema>,
  "count" | "description" | "handwritten" | "lines" | "points"
> & {
  grading: StoredWritingGrading;
  key: string;
  minutes: number | null;
  section: string;
  session: string | null;
};
