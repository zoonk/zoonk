import { type ExamIdentity } from "@zoonk/core/library/exams/identity";
import { listNoticeGoalsStep, proposeNoticeDatesStep } from "../goals/steps/notice-steps";
import { type ResearchAnalytics } from "./_utils/research-analytics";
import { extractBlueprintStep } from "./steps/extract-blueprint-step";
import { findNoticeReadingStep } from "./steps/is-notice-read-step";
import { saveBlueprintStep } from "./steps/save-blueprint-step";

export type SavedBlueprint = { created: boolean; examBlueprintId: string; movesExamDays: boolean };

/** The exam as its documents are read for it: its name and, when it has one, its role or phase. */
export function describeExam(identity: ExamIdentity): string {
  return identity.role ? `${identity.name}, ${identity.role}` : identity.name;
}

/**
 * Every goal on the exam whose date isn't the notice's new exam day gets that day as a change to
 * apply on Today, a page of goals per step. `exceptGoalId` is the goal whose own research proposes
 * it (see `reconcileResearch`).
 */
async function proposeNoticeDates({
  examBlueprintId,
  exceptGoalId,
  noticeId,
}: {
  examBlueprintId: string;
  exceptGoalId: string | null;
  noticeId: string | null;
}): Promise<void> {
  let after: string | null = null;

  do {
    // oxlint-disable-next-line no-await-in-loop -- Each page starts after the last one's goal.
    const page = await listNoticeGoalsStep({ after, examBlueprintId, exceptGoalId });

    // oxlint-disable-next-line no-await-in-loop -- One page at a time spares the database.
    await proposeNoticeDatesStep({ goalIds: page.goalIds, noticeId });
    after = page.next;
  } while (after);
}

/**
 * Reads the exam's documents once and saves what both citation checks kept. A
 * new exam needs a usable reading, or research asks the learner for the notice
 * instead of storing a guess. An existing blueprint is saved either way: an
 * unusable reading changes nothing but records the notice's new hash, so the
 * next check doesn't pay for the same reading again. Research never reads a
 * notice the blueprint was already read from (null), whatever instructions read
 * it; only an admin does (`force`), telling the reading what the stored
 * reading's check found it left out. A shared exam's reading is checked for that
 * (the OAB's ethics, left out of one reading of its 48th exam's notice) and
 * stored with its check. When the new reading moves the exam's days, every goal
 * on the exam whose date isn't the new day gets it as a change to apply: nothing
 * changes a learner's date silently.
 */
export async function readExamBlueprint({
  analytics,
  exceptGoalId = null,
  force = false,
  identity,
  isNew,
  background,
  sourceIds,
}: {
  analytics: ResearchAnalytics;
  /** The goal whose research is reading, which proposes its own changes. */
  exceptGoalId?: string | null;
  /**
   * An admin asked to read the notice again (`readNoticeAgainWorkflow`): it's read even when the
   * blueprint was read from it, the only way a reading is redone.
   */
  force?: boolean;
  identity: ExamIdentity;
  isNew: boolean;
  /**
   * A freshness check's reading waits on nothing, so it's read at the flex tier; a learner's plan
   * waits on research's reading, which runs at the standard one.
   */
  background: boolean;
  sourceIds: string[];
}): Promise<SavedBlueprint | null> {
  const [noticeId] = sourceIds;

  if (!noticeId) {
    return null;
  }

  const stored = isNew ? null : await findNoticeReadingStep({ identity, sourceId: noticeId });

  if (stored?.read && !force) {
    return null;
  }

  const shared = identity.ownerId === null;

  const reading = await extractBlueprintStep({
    analytics,
    background,
    corrections: stored?.problems ?? [],
    exam: describeExam(identity),
    shared,
    sourceIds,
  });

  if (isNew && !reading.usable) {
    return null;
  }

  const saved = await saveBlueprintStep({
    analytics,
    check: shared && reading.problems ? { problems: reading.problems } : null,
    identity,
    reading,
    sourceId: noticeId,
  });

  // Only the exam's own days reach learners' dates: a corrected notice that adds registration
  // days or start times proposes nothing.
  if (saved.movesExamDays) {
    await proposeNoticeDates({
      examBlueprintId: saved.examBlueprintId,
      exceptGoalId,
      noticeId: saved.noticeId,
    });
  }

  return saved;
}
