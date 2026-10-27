"use client";

import { AnswersSaveError } from "../_components/save-error";
import { TaskFrame } from "../shell/task-frame";
import { useCheckpointScreen } from "./checkpoint-context";

/** The checkpoint's frame: leave on the left, the duel's context in the middle. */
export function CheckpointFrame(props: Omit<React.ComponentProps<typeof TaskFrame>, "exitHref">) {
  const { hrefs } = useCheckpointScreen();
  return <TaskFrame {...props} exitHref={hrefs.exit} />;
}

/** A failed request says so plainly and offers to try again; nothing answered is lost. */
export function CheckpointError() {
  const { duel } = useCheckpointScreen();
  return duel.state.error ? <AnswersSaveError onRetry={() => void duel.retry()} /> : null;
}
