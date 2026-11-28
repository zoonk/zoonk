import { type ExamIdentity } from "@zoonk/core/library/exams/identity";
import { reconcileExamNotice } from "../freshness/reconcile-exam-notice";
import {
  listNoticeGoalsStep,
  logNoticeRepairFailureStep,
  prepareNoticeGraphRepairStep,
  repairNoticePlanStep,
} from "../goals/steps/notice-steps";
import { type ResearchAnalytics } from "./_utils/research-analytics";
import { extractBlueprint } from "./steps/extract-blueprint-step";
import { findNoticeReadingStep } from "./steps/is-notice-read-step";
import { refreshFollowerSummariesStep } from "./steps/link-goal-step";
import { saveBlueprintStep } from "./steps/save-blueprint-step";

export type SavedBlueprint = {
  created: boolean;
  examBlueprintId: string;
  movesExamDays: boolean;
  noticeId: string | null;
};

export async function reconcileReadExamBlueprint({
  analytics,
  exceptGoalId,
  saved,
  shared,
}: {
  analytics: ResearchAnalytics;
  exceptGoalId: string | null;
  saved: SavedBlueprint;
  shared: boolean;
}): Promise<void> {
  try {
    if (shared) {
      await reconcileExamNotice({ analytics, examBlueprintId: saved.examBlueprintId });
    }
  } finally {
    await updateExamNoticePlans({
      examBlueprintId: saved.examBlueprintId,
      exceptGoalId,
      movesExamDays: saved.movesExamDays,
      noticeId: saved.noticeId,
    });
  }
}

export function describeExam(identity: ExamIdentity): string {
  return identity.role ? `${identity.name}, ${identity.role}` : identity.name;
}

export async function updateExamNoticePlans({
  examBlueprintId,
  exceptGoalId,
  movesExamDays,
  noticeId,
}: {
  examBlueprintId: string;
  exceptGoalId: string | null;
  movesExamDays: boolean;
  noticeId: string | null;
}): Promise<void> {
  const notice = await prepareNoticeGraphRepairStep(examBlueprintId);

  if (!notice) {
    return;
  }

  let after: string | null = null;

  do {
    // oxlint-disable-next-line no-await-in-loop -- Each page starts after the last one's goal.
    const page = await listNoticeGoalsStep({ after, examBlueprintId, exceptGoalId });

    for (const goalId of page.goalIds) {
      try {
        // oxlint-disable-next-line no-await-in-loop -- One replan per blueprint at a time.
        await repairNoticePlanStep({
          blueprintId: examBlueprintId,
          goalId,
          movesExamDays,
          notice,
          noticeId,
        });
      } catch (error) {
        // oxlint-disable-next-line no-await-in-loop -- Report a failed goal before continuing.
        await logNoticeRepairFailureStep({
          blueprintId: examBlueprintId,
          error: String(error),
          goalId,
        });
      }
    }

    after = page.next;
  } while (after);
}

/**
 * Never reads a notice the blueprint was already read from, whatever instructions would read it;
 * only an admin's `force` does.
 */
export async function readExamBlueprint({
  analytics,
  board = null,
  exceptGoalId = null,
  force = false,
  identity,
  isNew,
  background,
  notDownloaded = [],
  sourceIds,
}: {
  analytics: ResearchAnalytics;
  /** The board the search for these documents named, when one did. */
  board?: string | null;
  exceptGoalId?: string | null;
  force?: boolean;
  identity: ExamIdentity;
  isNew: boolean;
  background: boolean;
  /** Addresses of the notice's required documents the search couldn't download. */
  notDownloaded?: string[];
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

  const reading = await extractBlueprint({
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
    board,
    check: shared && reading.problems ? { problems: reading.problems } : null,
    identity,
    notDownloaded,
    reading,
    reread: force,
    sourceId: noticeId,
  });

  await refreshFollowerSummariesStep(saved.examBlueprintId);

  if (background || !shared) {
    await reconcileReadExamBlueprint({ analytics, exceptGoalId, saved, shared });
  }

  return saved;
}
