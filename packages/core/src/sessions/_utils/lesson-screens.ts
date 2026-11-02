import "server-only";
import { getLessonGenerationStates } from "../../library/generation/lesson-generation-state";
import { type DayBlockScreen, type DayWork, getBlockScreen } from "../day-block";

type LessonStates = ReadonlyMap<string, { status: string }>;
type LessonBlock = Pick<DayWork, "kind" | "lessonId">;

/** Each block with where it plays by its lesson's state, once a read has the day's lessons. */
export function withLessonScreens<
  Day extends { blocks: readonly (LessonBlock & { screen: DayBlockScreen })[] },
>(day: Day, lessonStates: LessonStates): Day {
  return {
    ...day,
    blocks: day.blocks.map((block) => ({ ...block, screen: getBlockScreen(block, lessonStates) })),
  };
}

/** The states of the lessons these blocks teach; nothing is read for blocks without one. */
export async function readBlockLessonStates(blocks: readonly LessonBlock[]): Promise<LessonStates> {
  const lessonIds = [
    ...new Set(
      blocks.flatMap((block) => (block.kind === "learn" && block.lessonId ? [block.lessonId] : [])),
    ),
  ];

  return lessonIds.length > 0 ? getLessonGenerationStates(lessonIds) : new Map();
}

/** A day returned to the learner, with where each lesson block plays read from its lesson. */
export async function readLessonScreens<Day extends Parameters<typeof withLessonScreens>[0]>(
  day: Day,
): Promise<Day> {
  return withLessonScreens(day, await readBlockLessonStates(day.blocks));
}
