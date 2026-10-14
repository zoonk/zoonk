import "server-only";
import { toIsoDate } from "../planner/plan-calendar";
import { type Pace, choosePace } from "../planner/plan-pace";
import { type PlanState } from "../planner/plan-state";
import { PACE_LESSON_LIMIT, loadPaceSamples } from "./pace-samples";
import { type PlanContext } from "./plan-context";

/** The saved pace, or one sampled from the learner's progress now. */
async function choosePlanPace({
  lessons,
  now,
  pace,
  saved,
  userId,
}: {
  lessons: readonly { lessonId: string }[];
  now: Date;
  pace: "sampled" | "saved";
  saved: Pace | null;
  userId: string;
}): Promise<Pace> {
  if (pace === "saved" && saved) {
    return saved;
  }

  const samples = await loadPaceSamples({
    lessonIds: lessons.slice(0, PACE_LESSON_LIMIT).map((lesson) => lesson.lessonId),
    now,
    userId,
  });

  return choosePace(samples);
}

/** The settings a run plans with: its pace, the short mock's length, and its start day. */
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
