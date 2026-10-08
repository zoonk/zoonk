"use client";

import { useExtracted } from "next-intl";
import { TaskFrame } from "../shell/task-frame";
import { useCheckpointScreen } from "./checkpoint-context";

/** The checkpoint's frame: leave on the left, the duel's context in the middle. */
export function CheckpointFrame(props: Omit<React.ComponentProps<typeof TaskFrame>, "exitHref">) {
  const { hrefs } = useCheckpointScreen();
  return <TaskFrame {...props} exitHref={hrefs.exit} />;
}

/** A failed request says so plainly and offers to try again; nothing answered is lost. */
export function CheckpointError() {
  const t = useExtracted();
  const { duel } = useCheckpointScreen();

  if (!duel.state.error) {
    return null;
  }

  return (
    <p className="text-destructive text-center text-sm" role="alert">
      {t("That didn't go through. Your answers are saved.")}{" "}
      <button className="font-semibold underline" onClick={() => void duel.retry()} type="button">
        {t("Try again")}
      </button>
    </p>
  );
}
