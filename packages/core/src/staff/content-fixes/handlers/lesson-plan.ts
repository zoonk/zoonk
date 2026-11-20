import { isDeepStrictEqual } from "node:util";
import {
  type LessonSpec,
  estimateLessonMinutes,
  getLessonSpecIssues,
} from "@zoonk/ai/tasks/lesson-spec/rules";
import { type TransactionClient, sql } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { normalizeString } from "@zoonk/utils/string";
import { z } from "zod";
import { parseChallengeLessonSpec } from "../../../library/challenges/challenge-lesson-spec";
import { parseStoredLessonSpec } from "../../../library/lessons/_utils/stored-lesson-spec";
import { type Resolution, refuse } from "../_utils/resolved-change";
import { defineFixHandler, fieldTargets, idSchema } from "./fix-handler";

const MODEL = "Lesson";
const OP = "setPlan";
const planSchema = z.record(z.string(), z.json());

const proposedSchema = z.strictObject({
  id: idSchema,
  model: z.literal(MODEL),
  setPlan: planSchema,
});

const specField = z.object({ after: planSchema, before: planSchema, field: z.literal("spec") });

const minutesField = z.object({
  after: z.int(),
  before: z.int(),
  field: z.literal("estimatedMinutes"),
});

const storedSchema = z.object({
  fields: z.union([z.tuple([specField, minutesField]), z.tuple([specField])]),
  id: idSchema,
  model: z.literal(MODEL),
  op: z.literal(OP),
  restore: z.literal(true).optional(),
});

type Stored = z.infer<typeof storedSchema>;
type Plan = z.infer<typeof planSchema>;
type PreparedPlan = { problem: string } | { estimatedMinutes?: number; spec: Plan };

type Proposed = z.infer<typeof proposedSchema> & {
  restore?: { estimatedMinutes?: number; expected?: Stored["fields"] };
};

function screenKinds(spec: LessonSpec) {
  return spec.screens.map((screen) => screen.kind);
}

function ordinaryPlan({ after, before }: { after: Plan; before: Plan }) {
  const previous = after.kind === "challenge" ? null : parseStoredLessonSpec(before);
  const next = parseStoredLessonSpec({ ...after, estimatedMinutes: previous?.estimatedMinutes });

  if (!previous || !next) {
    return {
      problem: "Send the complete ordinary lesson plan with its title, skills and screens.",
    };
  }

  const existingIssues = getLessonSpecIssues(previous);

  const introduced = getLessonSpecIssues(next).filter(
    (issue) => !existingIssues.some((existing) => isDeepStrictEqual(issue, existing)),
  );

  if (introduced.length > 0) {
    return { problem: introduced.map((issue) => issue.detail).join(" ") };
  }

  const nextKinds = screenKinds(next);
  const changedKinds = !isDeepStrictEqual(nextKinds, screenKinds(previous));
  const estimatedMinutes = changedKinds ? estimateLessonMinutes(nextKinds) : undefined;

  return {
    after: { ...next, estimatedMinutes: estimatedMinutes ?? previous.estimatedMinutes },
    before: previous,
    estimatedMinutes,
  };
}

function challengePlan({ after, before }: { after: Plan; before: Plan }) {
  const previous = parseChallengeLessonSpec(before);
  const next = parseChallengeLessonSpec(after);

  return previous && next
    ? { after: next, before: previous, estimatedMinutes: undefined }
    : { problem: "Send the complete challenge lesson plan with its kind, variant and skills." };
}

function preparePlan({
  after,
  before,
  linkedNames,
}: {
  after: Plan;
  before: Plan;
  linkedNames: string[];
}): PreparedPlan {
  const plans =
    before.kind === "challenge"
      ? challengePlan({ after, before })
      : ordinaryPlan({ after, before });

  if (!plans.after) {
    return { problem: plans.problem };
  }

  const previousNames = new Set(plans.before.skills.map((skill) => skill.name));
  const linked = new Set(linkedNames);

  const unlinked = plans.after.skills.find(
    ({ name }) => !previousNames.has(name) && !linked.has(normalizeString(name)),
  );

  if (unlinked) {
    return {
      problem: `Plan skill "${unlinked.name}" must resolve to a skill linked to this lesson.`,
    };
  }

  return { estimatedMinutes: plans.estimatedMinutes, spec: { ...before, ...plans.after } };
}

async function resolve(
  db: TransactionClient,
  { id, restore, setPlan }: Proposed,
): Promise<Resolution<Stored>> {
  const row = await db.lesson.findUnique({
    select: {
      estimatedMinutes: true,
      skills: { select: { skill: { select: { normalizedName: true } } } },
      spec: true,
    },
    where: { id },
  });

  if (!isJsonObject(row?.spec)) {
    return refuse(row ? "This lesson has no stored plan to fix." : `No Lesson with id ${id}.`);
  }

  const before = row.spec;
  const estimatedBefore = row.estimatedMinutes;
  const [expectedSpec, expectedEstimate] = restore?.expected ?? [];

  if (
    expectedSpec &&
    (!isDeepStrictEqual(expectedSpec.after, before) ||
      (expectedEstimate && expectedEstimate.after !== estimatedBefore))
  ) {
    return refuse("The lesson plan changed after this fix was applied.");
  }

  const linkedNames = row.skills.map(({ skill }) => skill.normalizedName);

  const next: PreparedPlan = restore
    ? { estimatedMinutes: restore.estimatedMinutes, spec: setPlan }
    : preparePlan({ after: setPlan, before, linkedNames });

  if ("problem" in next) {
    return refuse(next.problem);
  }

  if (isDeepStrictEqual(before, next.spec)) {
    return refuse("This plan is already stored.");
  }

  const estimate = next.estimatedMinutes;
  const change = { after: next.spec, before, field: "spec" as const };

  const fields: Stored["fields"] =
    estimate !== undefined && estimate !== estimatedBefore
      ? [change, { after: estimate, before: estimatedBefore, field: "estimatedMinutes" }]
      : [change];

  return {
    effects: [{ kind: "planChanged", lessonId: id }],
    ok: true,
    stored: { fields, id, model: MODEL, op: OP, ...(restore && { restore: true }) },
    unit: { id, kind: "lesson" },
  };
}

const example = {
  id: "0193cfe6-604d-7fb2-ad00-f968c7542841",
  model: MODEL,
  setPlan: {
    kind: "challenge",
    skills: [{ description: "Recognize a conflict of interest.", name: "Conflicts of interest" }],
    variant: "work",
  },
};

export const lessonPlanSet = defineFixHandler<typeof MODEL, Proposed, Stored>({
  apply: async (tx, { fields: [spec, estimate], id }) => {
    const row = estimate
      ? null
      : await tx.lesson.findUniqueOrThrow({ select: { updatedAt: true }, where: { id } });

    await tx.lesson.update({
      data: { estimatedMinutes: estimate?.after, spec: spec.after, updatedAt: row?.updatedAt },
      where: { id },
    });
  },
  model: MODEL,
  op: OP,
  planRoots: ({ fields: [, estimate], id }) => ({ lessonIds: estimate ? [id] : [] }),
  proposal: {
    example,
    fields: ["spec"],
    rules:
      "Send the full ordinary or challenge plan from this lesson with the edits applied. Keep the plan kind. New or renamed skills must match a skill linked to the lesson. The server keeps planning metadata, recalculates the estimate when screen kinds change, and keeps the live screens.",
    schema: proposedSchema,
  },
  resolve,
  revert: (db, { fields, id }) =>
    resolve(db, {
      id,
      model: MODEL,
      restore: { estimatedMinutes: fields[1]?.before, expected: fields },
      setPlan: fields[0].before,
    }),
  stored: storedSchema,
  table: sql`library_lessons`,
  targets: (stored) => fieldTargets(stored),
  toProposed: ({ fields: [spec, estimate], id, restore }) => ({
    id,
    model: MODEL,
    restore: restore ? { estimatedMinutes: estimate?.after } : undefined,
    setPlan: spec.after,
  }),
});
