"use client";

import { AnswersSaveError } from "../_components/save-error";
import { TaskFrame } from "../shell/task-frame";
import { useCheckpointScreen } from "./checkpoint-context";

export function CheckpointFrame(props: Omit<React.ComponentProps<typeof TaskFrame>, "exitHref">) {
  const { hrefs } = useCheckpointScreen();
  return <TaskFrame {...props} exitHref={hrefs.exit} />;
}

export function CheckpointError() {
  const { duel } = useCheckpointScreen();
  return duel.state.error ? <AnswersSaveError onRetry={() => void duel.retry()} /> : null;
}
