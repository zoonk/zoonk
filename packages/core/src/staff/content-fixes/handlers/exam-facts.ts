import { DbNull, sql } from "@zoonk/db";
import { z } from "zod";
import {
  examEditionSchema,
  examStructureSchema,
  topicFrequencySchema,
} from "../../../library/exams/blueprint-contract";
import { toDateColumns } from "../../../library/exams/save-exam-blueprint";
import { courseWeightSubjectsSchema } from "../../../plans/planner/course-weights";
import { PRIVATE_CONTENT, toJson } from "../_utils/resolved-change";
import { idSchema } from "./fix-handler";
import { sharedRowHandler } from "./shared-row";

const text = z.string().trim().min(1);

const blueprintFields = {
  board: text.nullable(),
  edition: examEditionSchema.nullable(),
  name: text,
  role: text.nullable(),
  structure: examStructureSchema,
  topicFrequency: topicFrequencySchema.nullable(),
};

export const blueprintSet = sharedRowHandler({
  fields: blueprintFields,
  load: async (db, id) => {
    const row = await db.examBlueprint.findUnique({ where: { id } });

    return (
      row && {
        problem: row.ownerId || row.visibility !== "public" ? PRIVATE_CONTENT : undefined,
        roots: { blueprintIds: [id] },
        row: {
          board: row.board,
          edition: toJson(row.edition),
          name: row.name,
          role: row.role,
          structure: toJson(row.structure),
          topicFrequency: toJson(row.topicFrequency),
        },
        unit: { id, kind: "examBlueprint" },
      }
    );
  },
  model: "ExamBlueprint",
  rules:
    "Public blueprints with no owner. Canonical blueprint schemas apply. Existing mock exams keep their scoring snapshot; future planning reads corrected facts.",
  table: sql`exam_blueprints`,
  validate: async (_row, next, db) => {
    const scoring = examStructureSchema.parse(next.structure).mock?.scoring;

    if (
      scoring?.scale &&
      (scoring.scale.min >= scoring.scale.max ||
        (scoring.scale.passScore !== null &&
          (scoring.scale.passScore < scoring.scale.min ||
            scoring.scale.passScore > scoring.scale.max)))
    ) {
      return "The scoring scale must increase and contain its pass score.";
    }

    const ids = new Set<string>();

    function collect(value: unknown): void {
      if (Array.isArray(value)) {
        value.forEach((child) => collect(child));
        return;
      }

      if (value && typeof value === "object") {
        for (const [key, child] of Object.entries(value)) {
          if (key === "sourceId" && typeof child === "string") {
            ids.add(child);
          } else if (key === "sourceIds" && Array.isArray(child)) {
            child.forEach((id) => {
              if (typeof id === "string") {
                ids.add(id);
              }
            });
          } else {
            collect(child);
          }
        }
      }
    }

    collect(next);

    if ([...ids].some((id) => !idSchema.safeParse(id).success)) {
      return "Blueprint source ids must be UUIDs.";
    }

    if (ids.size > 0) {
      const found = await db.source.count({
        where: { id: { in: [...ids] }, ownerId: null, visibility: "public" },
      });

      if (found !== ids.size) {
        return "Every blueprint citation must name an existing public source with no owner.";
      }
    }

    return null;
  },
  write: (tx, id, values) =>
    tx.examBlueprint.update({
      data: {
        ...z
          .object({ board: text.nullable(), name: text, role: text.nullable() })
          .partial()
          .parse(values),
        ...(values.edition === undefined
          ? {}
          : {
              edition: values.edition === null ? DbNull : examEditionSchema.parse(values.edition),
              ...toDateColumns({
                edition:
                  values.edition === null
                    ? {
                        check: null,
                        citations: [],
                        dates: [],
                        noticeUrl: null,
                        questionCount: null,
                        sourceHash: null,
                        timeZone: null,
                        year: null,
                      }
                    : examEditionSchema.parse(values.edition),
              }),
            }),
        ...(values.topicFrequency === undefined
          ? {}
          : {
              topicFrequency:
                values.topicFrequency === null
                  ? DbNull
                  : topicFrequencySchema.parse(values.topicFrequency),
            }),
        ...(values.structure === undefined
          ? {}
          : { structure: examStructureSchema.parse(values.structure) }),
      },
      where: { id },
    }),
});

const cutoffFields = {
  edition: text.nullable(),
  maxScore: z.number().positive().nullable(),
  quota: text.nullable(),
  score: z.number().nonnegative().nullable(),
  sourceTitle: text.nullable(),
  sourceUrl: z.url().nullable(),
  status: z.enum(["found", "unknown"]),
};

export const cutoffSet = sharedRowHandler({
  fields: cutoffFields,
  load: async (db, id) => {
    const row = await db.targetCutoff.findUnique({
      include: { examBlueprint: { select: { ownerId: true, visibility: true } } },
      where: { id },
    });

    return (
      row && {
        problem:
          row.examBlueprint.ownerId || row.examBlueprint.visibility !== "public"
            ? PRIVATE_CONTENT
            : undefined,
        row: {
          edition: row.edition,
          maxScore: row.maxScore,
          quota: row.quota,
          score: row.score,
          sourceTitle: row.sourceTitle,
          sourceUrl: row.sourceUrl,
          status: row.status,
        },
        unit: { id: row.examBlueprintId, kind: "examBlueprint" },
      }
    );
  },
  model: "TargetCutoff",
  rules:
    "Public blueprint with no owner. Found cutoffs need a score, scale and source; goal snapshots already saved keep their copy.",
  table: sql`target_cutoffs`,
  validate: (_row, next) => {
    if (
      next.status === "found" &&
      (typeof next.score !== "number" ||
        typeof next.maxScore !== "number" ||
        next.score > next.maxScore ||
        !next.sourceUrl)
    ) {
      return "A found cutoff needs a score within its scale and a source URL.";
    }

    return next.status === "unknown" && (next.score !== null || next.maxScore !== null)
      ? "An unknown cutoff has no score or scale."
      : null;
  },
  write: (tx, id, values) =>
    tx.targetCutoff.update({ data: z.object(cutoffFields).partial().parse(values), where: { id } }),
});

const weightsFields = {
  edition: text.nullable(),
  sourceTitle: text.nullable(),
  sourceUrl: z.url().nullable(),
  status: z.enum(["found", "unknown"]),
  subjects: courseWeightSubjectsSchema,
};
export const weightsSet = sharedRowHandler({
  fields: weightsFields,
  load: async (db, id) => {
    const row = await db.examCourseWeights.findUnique({
      include: { examBlueprint: { select: { ownerId: true, visibility: true } } },
      where: { id },
    });

    return (
      row && {
        problem:
          row.examBlueprint.ownerId || row.examBlueprint.visibility !== "public"
            ? PRIVATE_CONTENT
            : undefined,
        row: {
          edition: row.edition,
          sourceTitle: row.sourceTitle,
          sourceUrl: row.sourceUrl,
          status: row.status,
          subjects: toJson(row.subjects),
        },
        unit: { id: row.examBlueprintId, kind: "examBlueprint" },
      }
    );
  },
  model: "ExamCourseWeights",
  rules:
    "Public blueprint with no owner. Positive subject weights with a source. Existing goals and plans keep their saved weights; future research reads the fix.",
  table: sql`exam_course_weights`,
  validate: (_row, next) => {
    const subjects = courseWeightSubjectsSchema.parse(next.subjects);

    if (
      next.status === "found" &&
      (!next.sourceUrl ||
        subjects.length === 0 ||
        new Set(subjects.map((subject) => subject.name)).size !== subjects.length)
    ) {
      return "Found weights need distinct subjects and a source.";
    }

    return next.status === "unknown" && subjects.length > 0
      ? "Unknown weights have no subjects."
      : null;
  },
  write: (tx, id, values) =>
    tx.examCourseWeights.update({
      data: z.object(weightsFields).partial().parse(values),
      where: { id },
    }),
});
