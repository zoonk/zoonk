import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";

/** Pictures, marks and citations can finish while a repair is running. Only hash its content. */
export async function readLessonRepairBase(
  { lessonId, version }: { lessonId: string; version: number },
  db: TransactionClient = prisma,
): Promise<string | null> {
  const [row] = await db.$queryRaw<{ fingerprint: string }[]>`
    SELECT md5(jsonb_build_array(
      lesson.spec,
      jsonb_agg(
        jsonb_build_array(
          step.id, step.position, step.kind, step.contract_version, step.content,
          step.skill_id, step.item_id, step.word_id, step.sentence_id,
          (
            SELECT jsonb_agg(
              jsonb_build_array(variant.kind, variant.key, variant.contract_version, variant.content)
              ORDER BY variant.kind, variant.key
            )
            FROM step_variants AS variant
            WHERE variant.step_id = step.id
          )
        ) ORDER BY step.position
      )
    )::text) AS fingerprint
    FROM library_lessons AS lesson
    JOIN library_steps AS step ON step.lesson_id = lesson.id
    WHERE lesson.id = ${lessonId}::uuid
      AND step.version = ${version}
      AND step.retired_at IS NULL
      AND NOT step.staged
    GROUP BY lesson.id
  `;

  return row?.fingerprint ?? null;
}
