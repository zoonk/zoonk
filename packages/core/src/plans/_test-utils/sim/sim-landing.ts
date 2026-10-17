import { createHash } from "node:crypto";
import { type PlannerLesson } from "../../planner/plan-units";
import { type SimLibrary } from "./sim-library";

const LANDED_BAND = "advanced" as const;
const LANDED_LESSON_MINUTES = 4;
const DEFAULT_SIZE = 3;

/** The Library writes between 60% and 140% of a skill's graph size, in steps of 10%. */
const LEAST_SHARE = 0.6;
const SHARE_STEP = 0.1;
const SHARE_STEPS = 9;

/** How many lessons the Library writes for a skill it outlines during a life. */
function countWrittenLessons({ shortId, size }: { shortId: string; size: number }): number {
  const steps = createHash("sha1").update(shortId).digest().readUInt32BE(0) % SHARE_STEPS;
  return Math.max(1, Math.round(size * (LEAST_SHARE + steps * SHARE_STEP)));
}

/** The lessons the Library writes for a skill the fixture has none for. */
export function writeLandedLessons({
  library,
  skillId,
}: {
  library: SimLibrary;
  skillId: string;
}): PlannerLesson[] {
  const shortId = library.short(skillId);
  const skill = library.graph.skills.find((entry) => entry.skillId === skillId);
  const count = countWrittenLessons({ shortId, size: skill?.lessons ?? DEFAULT_SIZE });

  return Array.from({ length: count }, (_, index) => ({
    band: LANDED_BAND,
    chapterId: library.toId(`landed:${shortId}`),
    lessonId: library.toId(`landed:${shortId}:${index + 1}`),
    minutes: LANDED_LESSON_MINUTES,
    skillIds: [skillId],
    title: `${skill?.name ?? shortId} ${index + 1}`,
  }));
}
