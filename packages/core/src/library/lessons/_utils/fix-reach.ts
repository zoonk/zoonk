import { isDeepStrictEqual } from "node:util";
import { type WrittenLesson } from "@zoonk/ai/tasks/v2/lesson-writer/schema";
import { type LessonGateProblem } from "../../quality/lesson-quality-gate";

type FixReach = {
  /**
   * The fix changed what no check pointed at: a screen no problem named, a screen it added, or
   * the summary card when no problem was about the whole lesson. Nothing has read that change.
   */
  strayed: boolean;
  /**
   * What the reviewer found wrong where the fix changed nothing: the screen it named, or the whole
   * lesson for a problem with no screen. It's still wrong.
   */
  unfixed: LessonGateProblem[];
};

/** The screens whose content the fix changed, or added; a screen it dropped (beyond the plan) adds nothing. */
function findChangedScreens({ draft, fixed }: { draft: WrittenLesson; fixed: WrittenLesson }) {
  return new Set(
    fixed.screens.flatMap((screen, index) =>
      isDeepStrictEqual(screen, draft.screens[index]) ? [] : [index],
    ),
  );
}

/**
 * Where a fix pass reached, compared with what the checks flagged. A fixed lesson isn't reviewed
 * again when the fix stayed on flagged screens (the code checks still run on it), so this guards
 * that shortcut: a change no check pointed at needs the review, and a screen the reviewer found
 * wrong that the fix left as it was holds the lesson back.
 */
export function getFixReach({
  draft,
  fixed,
  incorrect,
  problems,
}: {
  draft: WrittenLesson;
  fixed: WrittenLesson;
  /** The reviewer's blocking `incorrect` problems before the fix. */
  incorrect: readonly LessonGateProblem[];
  /** Every problem the fix pass was given, from code and from the reviewer. */
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
