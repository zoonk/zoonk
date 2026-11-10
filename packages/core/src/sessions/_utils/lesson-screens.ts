import "server-only";
import { getLessonGenerationStates } from "../../library/generation/lesson-generation-state";
import { type DayBlockScreen, type DayWork, getBlockScreen, isLessonLink } from "../day-block";

type LessonStates = ReadonlyMap<string, { status: string }>;

/** A GET's request-wide lesson states; without it, they're read fresh. */
export type LessonStatesReader = (lessonIds: readonly string[]) => Promise<LessonStates>;
type LessonBlock = Pick<DayWork, "kind" | "lessonId">;

/** A lapse preview omits saved IDs, so its caller retains the saved origin when deciding links. */
export function withLessonScreens<
  Day extends {
    blocks: readonly (LessonBlock & {
      screen: DayBlockScreen;
      status: "pending" | "active" | "completed" | "skipped";
      waitReason: "challenge" | "lessons" | null;
      id?: string;
    })[];
    current?: boolean;
    status?: string;
  },
>(
  day: Day,
  lessonStates: LessonStates,
  { saved = day.status !== "unstarted" }: { saved?: boolean } = {},
): Day {
  return {
    ...day,
    blocks: day.blocks.map((block) => {
      const screened = { ...block, screen: getBlockScreen(block, lessonStates) };

      return {
        ...screened,
        opensInPlayer: isLessonLink({ block: screened, current: day.current === true, saved }),
      };
    }),
  };
}

/** The states of the lessons these blocks teach; nothing is read for blocks without one. */
export async function readBlockLessonStates(
  blocks: readonly LessonBlock[],
  read: LessonStatesReader = getLessonGenerationStates,
): Promise<LessonStates> {
  const lessonIds = [
    ...new Set(
      blocks.flatMap((block) => (block.kind === "learn" && block.lessonId ? [block.lessonId] : [])),
    ),
  ];

  return read(lessonIds);
}

/** A day returned to the learner, with where each lesson block plays read from its lesson. */
export async function readLessonScreens<Day extends Parameters<typeof withLessonScreens>[0]>(
  day: Day,
  read?: LessonStatesReader,
): Promise<Day> {
  return withLessonScreens(day, await readBlockLessonStates(day.blocks, read));
}
