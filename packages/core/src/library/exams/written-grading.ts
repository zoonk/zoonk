import { z } from "zod";
import { type ExamStructure } from "./blueprint-contract";

export const citationSchema = z.object({ passage: z.string(), sourceId: z.string() });

const citedRuleSchema = z.object({ citation: citationSchema, text: z.string().min(1) });

export const writtenGradingSchema = z.object({
  criteria: z.array(
    citedRuleSchema.extend({ id: z.string().min(1), points: z.number().positive().nullable() }),
  ),
  kind: z.enum(["enem", "oab", "points", "levels"]),
  language: citedRuleSchema
    .extend({
      factor: z.number().nonnegative().nullable(),
      formula: z.string().nullable(),
      method: z.enum(["perError", "errorsPerLine", "other"]),
    })
    .nullable(),
  rounding: citedRuleSchema.nullable(),
  zeroing: z.array(
    citedRuleSchema.extend({
      kinds: z
        .array(
          z.enum([
            "blank",
            "offTopic",
            "wrongForm",
            "tooFewLines",
            "copiedSupport",
            "identification",
          ]),
        )
        .optional(),
      maxLines: z.int().positive().nullable().optional(),
    }),
  ),
});

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
