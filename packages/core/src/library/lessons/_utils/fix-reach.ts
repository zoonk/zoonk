import { isDeepStrictEqual } from "node:util";
import { type WrittenLesson } from "@zoonk/ai/tasks/v2/lesson-writer/schema";
import { type LessonGateProblem } from "../../quality/lesson-quality-gate";

type FixReach = { strayed: boolean; unfixed: LessonGateProblem[] };

function findChangedScreens({ draft, fixed }: { draft: WrittenLesson; fixed: WrittenLesson }) {
  return new Set(
    fixed.screens.flatMap((screen, index) =>
      isDeepStrictEqual(screen, draft.screens[index]) ? [] : [index],
    ),
  );
}

export function getFixReach({
  draft,
  fixed,
  incorrect,
  problems,
}: {
  draft: WrittenLesson;
  fixed: WrittenLesson;
  incorrect: readonly LessonGateProblem[];
  problems: readonly LessonGateProblem[];
}): FixReach {
  const changed = findChangedScreens({ draft, fixed });
  const summaryChanged = !isDeepStrictEqual(draft.summary, fixed.summary);
  const named = new Set(problems.flatMap((problem) => problem.screen ?? []));
  const lessonWide = problems.some((problem) => problem.screen === null);
  const lessonChanged = changed.size > 0 || summaryChanged;

  return {
    strayed: [...changed].some((index) => !named.has(index)) || (summaryChanged && !lessonWide),
    unfixed: incorrect.filter((problem) =>
      problem.screen === null ? !lessonChanged : !changed.has(problem.screen),
    ),
  };
}
