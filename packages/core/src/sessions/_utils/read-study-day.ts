import "server-only";
import { type ExamBlueprint, type Goal } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { readClaimEvents } from "../../learner/facts/claim-events";
import { readPracticeMistakes } from "../../learner/facts/practice-mistakes";
import { readPreparationInputs } from "../../learner/facts/preparation-inputs";
import { readSavedPlan } from "../../learner/facts/saved-plan";
import { readActiveSubscription } from "../../learner/facts/subscription";
import { readUsageTotals } from "../../learner/facts/usage-totals";
import { toIdKey } from "../../library/_utils/shared-rows";
import { readExamBlueprint } from "../../library/exams/read-exam-blueprint";
import { type DayView } from "../day-view";
import { loadUnstartedDayView } from "./load-unstarted-day";
import { planDayBlocks, planStudyDay, toUnstartedBlocks } from "./plan-study-day";
import { readSavedDayView } from "./read-saved-day-view";
import { readSavedDayPlan } from "./saved-day-plan";
import { findSavedDaySession } from "./saved-day-session";
import { type SelectedDayPlan } from "./selected-day-plan";
import { type SessionDayContext } from "./session-placement";

export type ReadStudyDay = {
  /** The goal's exam blueprint, read once for the day and whatever else the request shows. */
  blueprint: ExamBlueprint | null;
  selection: SelectedDayPlan | null;
  session: DayView;
  timeZone: string;
};

type PreviewInput = {
  blueprint: ExamBlueprint | null;
  goal: Goal;
  now: Date;
  /** The goal's answer zone (`getAnswerTimeZone`). */
  timeZone: string;
  userId: string;
};

async function selectPreviewDay({ blueprint, goal, now, timeZone, userId }: PreviewInput) {
  const savedPlan = await readSavedPlan(userId, goal.id);
  const selection = await readSavedDayPlan({ goal, now, saved: savedPlan, timeZone });

  if (!selection) {
    return null;
  }

  const context: SessionDayContext = {
    blueprint,
    goal,
    localDate: getDateInTimeZone({ date: now, timeZone }),
    now,
    readClaims: (skillIds: readonly string[]) =>
      readClaimEvents(userId, goal.id, toIdKey(skillIds)),
    readSubscription: readActiveSubscription,
    timeZone,
    userId,
  };

  return { context, selection };
}

/** The blocks Today shows before Start builds the day; the Plan and the challenge screen read today from them. */
export async function previewTodayBlocks(input: PreviewInput) {
  const preview = await selectPreviewDay(input);

  if (!preview) {
    return [];
  }

  const { blocks } = await planDayBlocks({ ...preview.context, selection: preview.selection });
  return toUnstartedBlocks(blocks);
}

/** Reads never move a zone, settle a plan, stamp a queue or create the day's session. */
export async function readStudyDay({
  goal,
  now,
  timeZone: requestedZone,
  userId,
}: {
  goal: Goal;
  now: Date;
  timeZone?: string;
  userId: string;
}): Promise<ReadStudyDay | null> {
  const timeZone = getAnswerTimeZone({ goal, timeZone: requestedZone });
  const localDate = getDateInTimeZone({ date: now, timeZone });

  const [saved, blueprint] = await Promise.all([
    findSavedDaySession({ goalId: goal.id, now, timeZone, userId }),
    goal.examBlueprintId ? readExamBlueprint(goal.examBlueprintId) : null,
  ]);

  if (saved) {
    return {
      blueprint,
      selection: null,
      session: await readSavedDayView({
        blueprint,
        session: saved,
        timeZone,
        userId,
        weekDate: localDate,
      }),
      timeZone,
    };
  }

  const preview = await selectPreviewDay({ blueprint, goal, now, timeZone, userId });

  if (!preview) {
    return null;
  }

  const { context, selection } = preview;

  const day = await planStudyDay({
    ...context,
    readMistakes: () => readPracticeMistakes(userId, goal.id),
    readPreparation: () => readPreparationInputs(userId, goal.id),
    readUsage: () => readUsageTotals(userId),
    selection,
  });

  return {
    blueprint,
    selection,
    session: await loadUnstartedDayView({ context, day, selection }),
    timeZone,
  };
}
