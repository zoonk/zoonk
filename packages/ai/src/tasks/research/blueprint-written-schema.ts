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
    .describe(
      "How many of the criterion's counted elements an answer needs for this level, when the level is defined by that count",
    ),
  points: z
    .number()
    .nullable()
    .describe("The points this level earns; null when the documents give the level no points"),
  pointsHigh: z
    .number()
    .nullable()
    .describe("The top of the level's span when the documents give a band of several marks"),
});

const criterionSchema = writtenRuleSchema.extend({
  awards: z
    .array(awardSchema)
    .describe(
      "The documents' own scale for this criterion, one level per row, lowest first, each with its descriptor as `text`; empty when they state no scale",
    ),
  id: z.string(),
  parts: z
    .array(writtenRuleSchema.extend({ id: z.string() }))
    .describe("The named elements the documents count toward this criterion's levels"),
  points: z.number().nullable(),
  weight: z
    .number()
    .nullable()
    .describe("Its weight when the criteria combine by a weighted mean; null otherwise"),
});

export const writtenGradingSchema = z.object({
  combination: writtenRuleSchema
    .extend({
      method: z
        .enum(["sum", "mean", "other"])
        .describe(
          "`sum` adds the criteria's marks, `mean` averages them (weighted when they have weights), `other` for any other way",
        ),
      step: z
        .number()
        .nullable()
        .describe("The unit the combined mark is reported in, such as half a band"),
    })
    .nullable()
    .describe("How the criteria's marks become the answer's mark, when the documents say"),
  conventions: z
    .array(writtenRuleSchema)
    .describe("The documents' own rules on what earns or loses credit in an answer"),
  criteria: z.array(criterionSchema),
  deductions: z
    .array(writtenRuleSchema)
    .describe(
      "Every other rule that takes a stated number of marks off the answer and no other field holds, such as a mark taken off a criterion per factual error",
    ),
  language: writtenRuleSchema
    .extend({
      factor: z.number().nullable(),
      formula: z.string().nullable(),
      method: z.enum(["perError", "errorsPerLine", "other"]),
    })
    .nullable(),
  limits: z
    .array(
      writtenRuleSchema.extend({
        criteria: z.array(z.string()).describe("The ids of the criteria the cap applies to"),
        max: z.number(),
      }),
    )
    .describe("Each case in which the documents cap criteria at fewer marks than their maximum"),
  rounding: writtenRuleSchema
    .extend({
      mode: z.enum(["nearest", "down", "up"]).nullable(),
      stage: z
        .enum(["criterion", "total"])
        .nullable()
        .describe("Whether each criterion's mark is rounded or only the answer's mark"),
      step: z.number().nullable().describe("The unit marks are rounded to, such as 0.01"),
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
  handwritten: z.boolean().nullable(),
  lines: z.int().nullable(),
  officialIdentifier: z.string().nullable(),
  plays: z.number().int().nullable(),
  points: z.number().nullable(),
});

type StoredRule = { citation: { passage: string; sourceId: string }; text: string };
export type ReadGrading = z.infer<typeof writtenGradingSchema>;
type ReadRule = "document" | "passage" | "text";

type StoredAward = StoredRule & { count?: number; points: number | null; pointsHigh?: number };

type StoredWritingGrading = {
  combination?: (StoredRule & { method: "sum" | "mean"; step: number | null }) | null;
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
