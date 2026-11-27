import { z } from "zod";
import { type ExamStructure } from "./blueprint-contract";

export const citationSchema = z.object({ passage: z.string(), sourceId: z.string() });

const citedRuleSchema = z.object({ citation: citationSchema, text: z.string().min(1) });

export const writingZeroKindSchema = z.enum([
  "blank",
  "offTopic",
  "wrongForm",
  "tooFewLines",
  "copiedSupport",
  "identification",
]);

const awardPoints = z.number().nonnegative();

const awardSchema = citedRuleSchema.extend({
  count: z
    .int()
    .positive()
    .optional()
    .describe("How many distinct counted parts an answer must show to earn this award"),
  points: awardPoints.nullable(),
  pointsHigh: awardPoints
    .optional()
    .describe("The top of the award's span when the board states a band of several marks"),
});

const criterionSchema = citedRuleSchema.extend({
  awards: z
    .array(awardSchema)
    .min(2)
    .optional()
    .describe(
      "The board's own scale for this criterion, lowest award first; only one applies to an answer. Absent when the board states a maximum and no scale.",
    ),
  id: z.string().min(1),
  parts: z
    .array(citedRuleSchema.extend({ id: z.string().min(1) }))
    .optional()
    .describe("The named elements the board counts toward this criterion's awards"),
  points: z.number().positive().nullable(),
  weight: z.number().positive().optional().describe("Its weight in a weighted mean; 1 when absent"),
});

const roundingSchema = citedRuleSchema.extend({
  mode: z.enum(["nearest", "down", "up"]).nullish(),
  stage: z
    .enum(["criterion", "total"])
    .nullish()
    .describe("Whether each criterion's mark is rounded or only the final mark"),
  step: z.number().positive().nullish().describe("The unit marks are rounded to, such as 0.01"),
});

const sheetSchema = z.object({
  combination: citedRuleSchema
    .extend({
      method: z.enum(["sum", "mean"]),
      step: z
        .number()
        .positive()
        .nullable()
        .describe("The unit the combined mark is reported in, such as half a band"),
    })
    .nullish()
    .describe("How the criteria's marks become the answer's mark; a sum when absent"),
  conventions: z
    .array(citedRuleSchema)
    .optional()
    .describe("The board's own rules on what earns or loses credit, as it words them"),
  criteria: z.array(criterionSchema),
  language: citedRuleSchema
    .extend({
      factor: z.number().nonnegative().nullable(),
      formula: z.string().nullable(),
      method: z.enum(["perError", "errorsPerLine", "other"]),
    })
    .nullable(),
  limits: z
    .array(
      citedRuleSchema.extend({
        criteria: z.array(z.string().min(1)).min(1),
        max: z.number().nonnegative(),
      }),
    )
    .optional()
    .describe("Cases in which the board caps the named criteria at fewer marks"),
  rounding: roundingSchema.nullable(),
  totalSuppressed: z
    .boolean()
    .optional()
    .describe(
      "True when a rule that changes the mark could not be read or verified, so no total is worked out",
    ),
  zeroing: z.array(
    citedRuleSchema.extend({
      kinds: z.array(writingZeroKindSchema).optional(),
      maxLines: z.int().positive().nullable().optional(),
    }),
  ),
});

function hasPoints(criterion: unknown): boolean {
  return (
    typeof criterion === "object" &&
    criterion !== null &&
    "points" in criterion &&
    typeof criterion.points === "number"
  );
}

/**
 * Sheets stored before awards existed carry a `kind`; on one with pointed criteria, `levels`
 * recorded that a rule was dropped.
 */
function readStoredSheet(stored: unknown): unknown {
  if (typeof stored !== "object" || stored === null || !("kind" in stored)) {
    return stored;
  }

  const { kind, ...sheet } = stored;
  const criteria = "criteria" in sheet && Array.isArray(sheet.criteria) ? sheet.criteria : [];

  return kind === "levels" && criteria.some((criterion) => hasPoints(criterion))
    ? { ...sheet, totalSuppressed: true }
    : sheet;
}

export const writtenGradingSchema = z.preprocess(readStoredSheet, sheetSchema);

export type WritingSheet = z.infer<typeof writtenGradingSchema>;

export const sectionTaskSchema = z.object({
  count: z.number().int().min(1),
  description: z.string(),
  grading: writtenGradingSchema.optional(),
  handwritten: z.boolean().optional(),
  key: z.string().min(1).optional(),
  lines: z.int().positive().optional(),
  officialIdentifier: z.string().min(1).optional(),
  plays: z.number().int().min(1).max(2).nullable().optional(),
  points: z.number().positive().optional(),
  /** The exam's subjects the notice says the task's questions are on; absent when it doesn't say. */
  subjects: z.array(z.string().min(1)).min(1).optional(),
});

const MAX_WRITTEN_TASKS_PER_SITTING = 24;

export function fitsWrittenSitting(count: number): boolean {
  return Number.isSafeInteger(count) && count >= 0 && count <= MAX_WRITTEN_TASKS_PER_SITTING;
}

export function withoutImplausibleWrittenCounts(structure: ExamStructure): ExamStructure {
  const { mock } = structure;

  if (!mock) {
    return structure;
  }

  const written = Map.groupBy(
    mock.sections.filter(({ kind }) => kind === "written"),
    ({ day }) => day,
  );

  const unverified = new Set(
    [...written].flatMap(([day, sections]) =>
      fitsWrittenSitting(
        sections.reduce(
          (total, section) =>
            total + (section.tasks ?? []).reduce((count, task) => count + task.count, 0),
          0,
        ),
      )
        ? []
        : [day],
    ),
  );

  return unverified.size === 0
    ? structure
    : {
        ...structure,
        mock: {
          ...mock,
          sections: mock.sections.map((section) =>
            section.kind === "written" && unverified.has(section.day)
              ? { ...section, tasks: [] }
              : section,
          ),
        },
      };
}
