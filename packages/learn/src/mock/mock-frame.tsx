"use client";

import { useExtracted } from "next-intl";
import { TaskFrame } from "../shell/task-frame";
import { useMockScreen } from "./mock-context";

/** The mock's frame: the section and its clock in the middle, the flag on the right. */
export function MockFrame(props: Omit<React.ComponentProps<typeof TaskFrame>, "exitHref">) {
  const { hrefs } = useMockScreen();
  return <TaskFrame {...props} exitHref={hrefs.exit} />;
}

/**
 * Under the mock's main action: a failed save or step says so plainly (answers already given are
 * kept, and the button tries again), and a step taking longer than usual says it's still going.
 */
export function MockStepStatus() {
  const t = useExtracted();
  const { runner } = useMockScreen();

  if (runner.error) {
    return (
      <p className="text-destructive text-center text-sm" role="alert">
        {t("That didn't go through. Your answers are saved. Try again in a moment.")}
      </p>
    );
  }

  if (!runner.slow) {
    return null;
  }

  return (
    <p className="text-muted-foreground text-center text-sm" role="status">
      {runner.busy === "start"
        ? t("Still starting. This is taking longer than usual.")
        : t("Still handing it in. This is taking longer than usual.")}
    </p>
  );
}
