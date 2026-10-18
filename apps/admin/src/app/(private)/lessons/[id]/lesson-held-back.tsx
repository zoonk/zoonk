import { type LibraryLessonDetail } from "@/data/lessons/get-library-lesson";
import { formatDateTime } from "@/lib/format";
import {
  MAX_LESSON_DRAFTS,
  parseHeldBackDrafts,
} from "@zoonk/core/library/generation/held-back-drafts";

type Lesson = LibraryLessonDetail["lesson"];

/**
 * The drafts the quality gate held back since the lesson was last published, with the model that
 * wrote each and what held it back, and whether the lesson was set aside after its last one (plans
 * skipped it and nothing writes it again).
 */
export function LessonHeldBack({ lesson }: { lesson: Lesson }) {
  const drafts = parseHeldBackDrafts(lesson.heldBackDrafts);

  if (drafts.length === 0) {
    return <span className="text-muted-foreground">None</span>;
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <span>
        {drafts.length} of {MAX_LESSON_DRAFTS} drafts
        {lesson.setAsideAt ? ` · set aside ${formatDateTime(lesson.setAsideAt)}` : ""}
      </span>

      <ol className="flex flex-col items-end gap-2">
        {drafts.map((draft) => (
          <li className="flex flex-col items-end gap-0.5" key={draft.runId + draft.heldBackAt}>
            <span className="text-muted-foreground text-xs">
              {draft.model} · {formatDateTime(draft.heldBackAt)}
            </span>

            {draft.problems.map((problem) => (
              <span className="max-w-md text-xs" key={`${problem.screen}:${problem.problem}`}>
                {problem.screen === null ? "Whole lesson" : `Screen ${problem.screen + 1}`}:{" "}
                {problem.problem}
              </span>
            ))}
          </li>
        ))}
      </ol>
    </div>
  );
}
