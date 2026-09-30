import { logInfo } from "@zoonk/utils/logger";
import { type Client, escapeIdentifier, escapeLiteral } from "pg";
import { runInOrder } from "./rows";

type TargetKind = "chapter" | "item" | "lesson" | "skill" | "step";

/**
 * How a replaced row is found again after the copy. Chapters, lessons and skills have one identity
 * per language, a step is its lesson's screen at a position, and items only have their id.
 */
type Target = { join: string; keys: string[]; table: string };

const IDENTITY_KEYS = ["target.language", "target.identity_key"];

const TARGETS: Record<TargetKind, Target> = {
  chapter: { join: "", keys: IDENTITY_KEYS, table: "library_chapters" },
  item: { join: "", keys: ["target.id"], table: "items" },
  lesson: { join: "", keys: IDENTITY_KEYS, table: "library_lessons" },
  skill: { join: "", keys: IDENTITY_KEYS, table: "skills" },
  step: {
    join: "JOIN library_lessons lesson ON lesson.id = target.lesson_id",
    keys: ["lesson.language", "lesson.identity_key", "target.position"],
    table: "library_steps",
  },
};

/**
 * A local learner's link to replaced content. `update` links are set to null by the removal and
 * pointed at the copied row afterwards; `reinsert` rows would block the removal (`learner_skills`)
 * or go with it (`step_example_lines`), so they are set aside and inserted back.
 */
type LearnerReference = {
  column: string;
  restore: "reinsert" | "update";
  table: string;
  target: TargetKind;
};

export const LEARNER_REFERENCES: readonly LearnerReference[] = [
  { column: "chapter_id", restore: "update", table: "plan_items", target: "chapter" },
  { column: "lesson_id", restore: "update", table: "plan_items", target: "lesson" },
  { column: "skill_id", restore: "update", table: "plan_items", target: "skill" },
  { column: "lesson_id", restore: "update", table: "study_session_blocks", target: "lesson" },
  {
    column: "library_lesson_id",
    restore: "update",
    table: "lesson_question_threads",
    target: "lesson",
  },
  { column: "library_step_id", restore: "update", table: "lesson_questions", target: "step" },
  { column: "chapter_id", restore: "update", table: "language_conversations", target: "chapter" },
  { column: "step_id", restore: "update", table: "attempts", target: "step" },
  { column: "skill_id", restore: "update", table: "attempts", target: "skill" },
  { column: "item_id", restore: "update", table: "attempts", target: "item" },
  { column: "step_id", restore: "update", table: "mistakes", target: "step" },
  { column: "skill_id", restore: "update", table: "mistakes", target: "skill" },
  { column: "item_id", restore: "update", table: "mistakes", target: "item" },
  { column: "item_id", restore: "update", table: "mock_exam_answers", target: "item" },
  { column: "skill_id", restore: "reinsert", table: "learner_skills", target: "skill" },
  { column: "step_id", restore: "reinsert", table: "step_example_lines", target: "step" },
];

type ReferenceCounts = readonly number[];

function getSavedTable(index: number): string {
  return `sync_reference_${index}`;
}

function getKeyAlias(index: number): string {
  return `key_${index}`;
}

function getSnapshotQuery({ index, reference }: { index: number; reference: LearnerReference }) {
  const target = TARGETS[reference.target];
  const keys = target.keys.map((key, keyIndex) => `${key} AS ${getKeyAlias(keyIndex)}`).join(", ");
  const saved = reference.restore === "reinsert" ? "ref.*" : "ref.id";

  return `CREATE TEMP TABLE ${getSavedTable(index)} ON COMMIT DROP AS
          SELECT ${saved}, ${keys}
            FROM ${escapeIdentifier(reference.table)} ref
            JOIN ${target.table} target ON target.id = ref.${escapeIdentifier(reference.column)}
            ${target.join}
           WHERE target.id IN (SELECT id FROM sync_removed
                                WHERE table_name = ${escapeLiteral(target.table)})`;
}

async function snapshotReference({
  destination,
  index,
  reference,
}: {
  destination: Client;
  index: number;
  reference: LearnerReference;
}): Promise<number> {
  await destination.query(getSnapshotQuery({ index, reference }));

  const result = await destination.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM ${getSavedTable(index)}`,
  );

  if (reference.restore === "reinsert") {
    await destination.query(
      `DELETE FROM ${escapeIdentifier(reference.table)}
        WHERE id IN (SELECT id FROM ${getSavedTable(index)})`,
    );
  }

  return result.rows[0]?.count ?? 0;
}

/**
 * Saves each local learner link to content the sync replaces, with the natural key that finds the
 * content again. Run it after `markRemovedContent` and before clearing.
 */
export async function snapshotLearnerReferences(destination: Client): Promise<ReferenceCounts> {
  return runInOrder(
    LEARNER_REFERENCES.map(
      (reference, index) => () => snapshotReference({ destination, index, reference }),
    ),
  );
}

function getKeyMatch(target: Target): string {
  return target.keys.map((key, index) => `${key} = saved.${getKeyAlias(index)}`).join(" AND ");
}

async function getColumns({ destination, table }: { destination: Client; table: string }) {
  const result = await destination.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position`,
    [table],
  );

  return result.rows.map((row) => row.column_name);
}

async function reinsertRows({
  destination,
  index,
  reference,
}: {
  destination: Client;
  index: number;
  reference: LearnerReference;
}): Promise<number> {
  const target = TARGETS[reference.target];
  const columns = await getColumns({ destination, table: reference.table });

  const values = columns.map((column) =>
    column === reference.column ? "target.id" : `saved.${escapeIdentifier(column)}`,
  );

  const result = await destination.query(
    `INSERT INTO ${escapeIdentifier(reference.table)} (${columns.map((column) => escapeIdentifier(column)).join(", ")})
     SELECT ${values.join(", ")}
       FROM ${getSavedTable(index)} saved, ${target.table} target ${target.join}
      WHERE ${getKeyMatch(target)}`,
  );

  return result.rowCount ?? 0;
}

async function updateLinks({
  destination,
  index,
  reference,
}: {
  destination: Client;
  index: number;
  reference: LearnerReference;
}): Promise<number> {
  const target = TARGETS[reference.target];

  const result = await destination.query(
    `UPDATE ${escapeIdentifier(reference.table)} ref
        SET ${escapeIdentifier(reference.column)} = target.id
       FROM ${getSavedTable(index)} saved, ${target.table} target ${target.join}
      WHERE ref.id = saved.id AND ${getKeyMatch(target)}`,
  );

  return result.rowCount ?? 0;
}

async function restoreReference({
  destination,
  expected,
  index,
  reference,
}: {
  destination: Client;
  expected: number;
  index: number;
  reference: LearnerReference;
}): Promise<void> {
  const restored =
    reference.restore === "reinsert"
      ? await reinsertRows({ destination, index, reference })
      : await updateLinks({ destination, index, reference });

  const name = `${reference.table}.${reference.column}`;

  if (restored !== expected) {
    throw new Error(
      `Could not keep ${expected - restored} local ${name} links: the source has no matching ${reference.target}`,
    );
  }

  if (restored > 0) {
    logInfo(`Kept ${restored} local ${name} links`);
  }
}

/**
 * Points each saved learner link at the copied content with the same natural key, and fails (so the
 * whole sync rolls back) when the source doesn't have that content anymore.
 */
export async function restoreLearnerReferences({
  destination,
  expected,
}: {
  destination: Client;
  expected: ReferenceCounts;
}): Promise<void> {
  await runInOrder(
    LEARNER_REFERENCES.map(
      (reference, index) => () =>
        restoreReference({ destination, expected: expected[index] ?? 0, index, reference }),
    ),
  );
}
