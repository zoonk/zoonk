"use client";

import { type WritingPrompt, type WritingResult } from "@zoonk/core/exams/essays/writing-contract";
import { TaskHeaderTitle } from "../_components/task-header";
import { TaskFrame } from "../shell/task-frame";
import { useHeaderLabel } from "./writing-header";
import { WritingResultView } from "./writing-result";

/** A past answer from the written part's page, read as its result was. */
export function WritingAnswerScreen({
  answer,
  exitHref,
}: {
  answer: { grade: WritingResult; text: string; writing: WritingPrompt };
  exitHref: string;
}) {
  const label = useHeaderLabel(answer.writing);

  return (
    <TaskFrame
      exitHref={exitHref}
      headerTitle={<TaskHeaderTitle title={answer.writing.title || label} />}
    >
      <WritingResultView grade={answer.grade} prompt={answer.writing} text={answer.text} />
    </TaskFrame>
  );
}
