import "server-only";
import { toIsoDate } from "../planner/plan-calendar";
import {
  type CalibratedPace,
  type PaceFamily,
  choosePace,
  getPaceFamily,
  keepSlowerPace,
} from "../planner/plan-pace";
import { type PlanState } from "../planner/plan-state";
import { PACE_LESSON_LIMIT, loadPaceSamples } from "./pace-samples";
import { type PlanContext } from "./plan-context";

/**
 * Never faster than the saved pace: a run the learner didn't ask for adds no lesson because they
 * studied faster.
 */
async function choosePlanPace({
  family,
  lessons,
  now,
  pace,
  saved,
  userId,
}: {
  family: PaceFamily;
  lessons: readonly { lessonId: string }[];
  now: Date;
  pace: "sampled" | "saved";
  saved: CalibratedPace | null;
  userId: string;
}): Promise<CalibratedPace> {
  if (pace === "saved" && saved) {
    return saved;
  }

  const samples = await loadPaceSamples({
    family,
    lessonIds: lessons.slice(0, PACE_LESSON_LIMIT).map((lesson) => lesson.lessonId),
    now,
    userId,
  });

  const sampled = choosePace(samples);

  return keepSlowerPace({ family, sampled, saved });
}

export async function choosePlanSettings({
  context,
  inputs,
  now,
  paceSource,
  state,
}: {
  context: PlanContext;
  inputs: { lessons: readonly { lessonId: string }[]; shortMockMinutes: number | null };
  now: Date;
  paceSource: "sampled" | "saved";
  state: PlanState;
}) {
  const pace = await choosePlanPace({
    family: getPaceFamily(context.goal.targetLanguage),
    lessons: inputs.lessons,
    now,
    pace: paceSource,
    saved: state.settings.pace,
    userId: context.goal.userId,
  });

  return {
    ...state.settings,
    pace,
    shortMockMinutes: inputs.shortMockMinutes,
    startDate: state.settings.startDate ?? toIsoDate(context.today),
  };
}
