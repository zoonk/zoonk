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

const awardSchema = writtenRuleSchema.extend({
  count: z
    .int()
    .nullable()
    .describe("How many distinct counted parts an answer must show to earn this award"),
  points: z.number().nullable(),
  pointsHigh: z
    .number()
    .nullable()
    .describe("The top of the award's span when the documents give a band of several marks"),
});

const criterionSchema = writtenRuleSchema.extend({
  awards: z
    .array(awardSchema)
    .describe("The documents' own scale for this criterion, lowest award first"),
  id: z.string(),
  parts: z.array(writtenRuleSchema.extend({ id: z.string() })),
  points: z.number().nullable(),
  weight: z.number().nullable(),
});

const writtenGradingSchema = z.object({
  combination: writtenRuleSchema
    .extend({
      method: z.enum(["sum", "mean"]),
      step: z
        .number()
        .nullable()
        .describe("The unit the combined mark is reported in, such as half a band"),
    })
    .nullable(),
  conventions: z.array(writtenRuleSchema),
  criteria: z.array(criterionSchema),
  language: writtenRuleSchema
    .extend({
      factor: z.number().nullable(),
      formula: z.string().nullable(),
      method: z.enum(["perError", "errorsPerLine", "other"]),
    })
    .nullable(),
  limits: z.array(writtenRuleSchema.extend({ criteria: z.array(z.string()), max: z.number() })),
  rounding: writtenRuleSchema
    .extend({
      mode: z.enum(["nearest", "down", "up"]).nullable(),
      stage: z.enum(["criterion", "total"]).nullable(),
      step: z.number().nullable(),
    })
    .nullable(),
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
type ReadGrading = z.infer<typeof writtenGradingSchema>;
type ReadRule = "document" | "passage" | "text";

type StoredAward = StoredRule & { count?: number; points: number | null; pointsHigh?: number };

type StoredWritingGrading = {
  combination?: (StoredRule & Omit<NonNullable<ReadGrading["combination"]>, ReadRule>) | null;
  conventions?: StoredRule[];
  criteria: (StoredRule & {
    awards?: StoredAward[];
    id: string;
    parts?: (StoredRule & { id: string })[];
    points: number | null;
    weight?: number;
  })[];
  language: (StoredRule & Omit<NonNullable<ReadGrading["language"]>, ReadRule>) | null;
  limits?: (StoredRule & { criteria: string[]; max: number })[];
  rounding:
    | (StoredRule & {
        mode?: "nearest" | "down" | "up" | null;
        stage?: "criterion" | "total" | null;
        step?: number | null;
      })
    | null;
  totalSuppressed?: boolean;
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
