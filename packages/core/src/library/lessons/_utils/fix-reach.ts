import { isDeepStrictEqual } from "node:util";

type ReviewedLesson = { screens: readonly unknown[]; summary: readonly string[] };

type ScreenProblem = { screen: number | null };

function findChangedScreens({ draft, fixed }: { draft: ReviewedLesson; fixed: ReviewedLesson }) {
  return new Set(
    fixed.screens.flatMap((screen, index) =>
      isDeepStrictEqual(screen, draft.screens[index]) ? [] : [index],
    ),
  );
}

export function getFixReach<Problem extends ScreenProblem>({
  draft,
  fixed,
  incorrect,
  problems,
}: {
  draft: ReviewedLesson;
  fixed: ReviewedLesson;
  incorrect: readonly Problem[];
  problems: readonly ScreenProblem[];
}): { strayed: boolean; unfixed: Problem[] } {
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
