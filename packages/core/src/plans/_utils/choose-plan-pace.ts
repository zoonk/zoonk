import "server-only";
import { type Pace, choosePace } from "../planner/plan-pace";
import { loadPaceSamples } from "./pace-samples";

/** The course pace compares others on the lessons the learner has coming up. */
const PACE_LESSON_LIMIT = 500;

/** The pace a plan is computed at: the one it was saved with, else sampled now. */
export async function choosePlanPace({
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
