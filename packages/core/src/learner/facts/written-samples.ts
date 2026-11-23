import "server-only";
import { type TransactionClient, prisma, sql } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { z } from "zod";
import { getLearnerModelCacheTag } from "../../cache/tags";
import { writingRangeSchema, writtenAnswerSchema } from "../../exams/essays/writing-contract";
import { isNumericWritingRubric } from "../../exams/essays/writing-rubric-policy";

const samplePrompt = writtenAnswerSchema.shape.writing.pick({
  assessedSkillIds: true,
  criteria: true,
  grading: true,
  lines: true,
  part: true,
  points: true,
  taskBasis: true,
  taskKey: true,
  title: true,
  unit: true,
});

const feedback = {
  criteria: z.array(
    z.object({ id: z.string(), level: z.enum(["missing", "partial", "strong", "complete"]) }),
  ),
  errorCount: z.int().nonnegative(),
};

const sampleGrade = z.discriminatedUnion("kind", [
  z.object({ ...feedback, kind: z.literal("levels") }),
  z.object({
    ...feedback,
    content: writingRangeSchema,
    kind: z.literal("points"),
    max: z.number().positive(),
    rows: z.array(
      z.object({
        earned: z.number(),
        id: z.string(),
        max: z.number().positive(),
        range: writingRangeSchema.optional(),
      }),
    ),
    total: writingRangeSchema,
  }),
]);

type SampleRow = {
  answeredAt: Date;
  conditions: unknown;
  durationMs: number;
  grade: unknown;
  id: string;
  itemId: string;
  localDate: Date;
  mockExamId: string | null;
  prompt: unknown;
  studySessionId: string | null;
};

type SampleScope =
  | { goalId: string }
  | { examBlueprintId: string | null; firstDraft: true; wholeAnswers?: boolean };

export async function loadWrittenSamples({
  scope,
  tx = prisma,
  userId,
}: {
  scope: SampleScope;
  tx?: TransactionClient;
  userId: string;
}) {
  const filter =
    "goalId" in scope
      ? sql`AND (
      (mock.goal_id = ${scope.goalId}::uuid AND mock.status = 'finished' AND mock.user_id = a.user_id)
      OR (a.mock_exam_id IS NULL AND session.goal_id = ${scope.goalId}::uuid AND session.user_id = a.user_id)
    )`
      : sql`AND a.answer ->> 'examBlueprintId' IS NOT DISTINCT FROM ${scope.examBlueprintId}::uuid::text
      AND a.answer #>> '{conditions,version}' = 'firstDraft'
      ${scope.wholeAnswers ? sql`AND a.answer #>> '{writing,unit}' = 'answer'` : sql``}`;

  const attempts = await tx.$queryRaw<SampleRow[]>(sql`
    SELECT a.id, a.answer ->> 'itemId' AS "itemId", a.answered_at AS "answeredAt", a.local_date AS "localDate",
           a.duration_ms AS "durationMs", a.mock_exam_id AS "mockExamId",
           a.study_session_id AS "studySessionId", a.answer -> 'conditions' AS conditions,
           jsonb_build_object(
             'kind', a.answer #> '{grade,kind}',
             'criteria', COALESCE((
               SELECT jsonb_agg(jsonb_build_object('id', entry -> 'id', 'level', entry -> 'level'))
               FROM jsonb_array_elements(a.answer #> '{grade,criteria}') entry
             ), '[]'::jsonb),
             'errorCount', jsonb_array_length(a.answer #> '{grade,errors}'),
             'content', a.answer #> '{grade,content}',
             'max', a.answer #> '{grade,max}',
             'rows', a.answer #> '{grade,rows}',
             'total', a.answer #> '{grade,total}'
           ) AS grade,
           (a.answer -> 'writing') - ARRAY[
             'charactersPerLine', 'keySource', 'minimumWords', 'partMinimum'
           ] AS prompt
    FROM attempts a
    ${
      "goalId" in scope
        ? sql`
      LEFT JOIN mock_exams mock ON mock.id = a.mock_exam_id
      LEFT JOIN study_sessions session ON session.id = a.study_session_id
    `
        : sql``
    }
    WHERE a.user_id = ${userId}::uuid AND a.answer ->> 'itemId' IS NOT NULL
      AND jsonb_typeof(a.answer #> '{grade,criteria}') = 'array'
      AND jsonb_typeof(a.answer #> '{grade,errors}') = 'array'
      AND jsonb_typeof(a.answer -> 'writing') = 'object'
      ${filter}
    ORDER BY a.answered_at DESC, a.id DESC
  `);

  return attempts.flatMap(({ conditions, grade, prompt, ...attempt }) => {
    const savedConditions = writtenAnswerSchema.shape.conditions.safeParse(conditions).data;
    const savedGrade = sampleGrade.safeParse(grade).data;
    const savedPrompt = samplePrompt.safeParse(prompt).data;
    const origin = attempt.mockExamId ? "mock" : "block";

    return savedConditions?.origin === origin && savedGrade && savedPrompt
      ? [
          {
            ...attempt,
            answer: { conditions: savedConditions, grade: savedGrade },
            numericEligible: isNumericWritingRubric(savedPrompt),
            prompt: savedPrompt,
          },
        ]
      : [];
  });
}

export async function readWrittenSamples({ goalId, userId }: { goalId: string; userId: string }) {
  "use cache: private";

  cacheTag(getLearnerModelCacheTag(userId));

  return loadWrittenSamples({ scope: { goalId }, userId });
}

export type WrittenSample = Awaited<ReturnType<typeof readWrittenSamples>>[number];
