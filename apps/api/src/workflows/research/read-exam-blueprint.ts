import { type ExamIdentity } from "@zoonk/core/library/exams/identity";
import { listNoticeGoalsStep, proposeNoticeDatesStep } from "../goals/steps/notice-steps";
import { type ResearchAnalytics } from "./_utils/research-analytics";
import { extractBlueprintStep } from "./steps/extract-blueprint-step";
import { findNoticeReadingStep } from "./steps/is-notice-read-step";
import { saveBlueprintStep } from "./steps/save-blueprint-step";

export type SavedBlueprint = { created: boolean; examBlueprintId: string; movesExamDays: boolean };

export function describeExam(identity: ExamIdentity): string {
  return identity.role ? `${identity.name}, ${identity.role}` : identity.name;
}

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
 * Never reads a notice the blueprint was already read from, whatever instructions would read it;
 * only an admin's `force` does.
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
  exceptGoalId?: string | null;
  force?: boolean;
  identity: ExamIdentity;
  isNew: boolean;
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

  if (saved.movesExamDays) {
    await proposeNoticeDates({
      examBlueprintId: saved.examBlueprintId,
      exceptGoalId,
      noticeId: saved.noticeId,
    });
  }

  return saved;
}
