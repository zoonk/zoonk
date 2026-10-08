import { type ExamIdentity } from "@zoonk/core/library/exams/identity";
import { listNoticeGoalsStep, proposeNoticeDatesStep } from "../goals/steps/notice-steps";
import { type ResearchAnalytics } from "./_utils/research-analytics";
import { extractBlueprintStep } from "./steps/extract-blueprint-step";
import { isNoticeReadStep } from "./steps/is-notice-read-step";
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
 * Reads the exam's documents and saves what both citation checks kept. A new
 * exam needs a usable reading, or research asks the learner for the notice
 * instead of storing a guess. An existing blueprint is saved either way: an
 * unusable reading changes nothing but records the notice's new hash, so the
 * next check doesn't pay for the same reading again; a notice it was already
 * read from, with the same instructions, isn't read again (null). When the new
 * reading moves the exam's days, every goal on the exam whose date isn't the new
 * day gets it as a change to apply: nothing changes a learner's date silently.
 */
export async function readExamBlueprint({
  analytics,
  exceptGoalId = null,
  identity,
  isNew,
  background,
  quiet = false,
  sourceIds,
}: {
  analytics: ResearchAnalytics;
  /** The goal whose research is reading, which proposes its own changes. */
  exceptGoalId?: string | null;
  identity: ExamIdentity;
  isNew: boolean;
  /**
   * A freshness check's reading waits on nothing, so it's read at the flex tier; a learner's plan
   * waits on research's reading, which runs at the standard one.
   */
  background: boolean;
  /**
   * The edition was read already, by older instructions (`isNoticeReadAgain`): what the new
   * reading changes is how well the exam is read, not the exam, so learners get no notice of it.
   * New exam days still reach their goals as a change to apply.
   */
  quiet?: boolean;
  sourceIds: string[];
}): Promise<SavedBlueprint | null> {
  const [noticeId] = sourceIds;

  if (!noticeId) {
    return null;
  }

  if (!isNew && (await isNoticeReadStep({ identity, sourceId: noticeId }))) {
    return null;
  }

  const reading = await extractBlueprintStep({
    analytics,
    background,
    exam: describeExam(identity),
    shared: identity.ownerId === null,
    sourceIds,
  });

  if (isNew && !reading.usable) {
    return null;
  }

  const saved = await saveBlueprintStep({
    analytics,
    identity,
    quiet,
    reading,
    sourceId: noticeId,
  });

  // Only the exam's own days reach learners' dates: a reading that adds registration days or
  // start times (as newer instructions read more of the same notice) proposes nothing.
  if (saved.movesExamDays) {
    await proposeNoticeDates({
      examBlueprintId: saved.examBlueprintId,
      exceptGoalId,
      noticeId: saved.noticeId,
    });
  }

  return saved;
}
