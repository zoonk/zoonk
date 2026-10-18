"use client";

import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { StepEyebrow } from "../_components/step-card";
import { TaskFrame } from "../shell/task-frame";
import { useMockScreen } from "./mock-context";
import { useMockShapeLabel } from "./mock-labels";

/**
 * The mock's frame: leave on the left, the section's clock in the middle, the answer sheet on the
 * right. Leaving right after an answer waits for it to be saved.
 */
export function MockFrame(
  props: Omit<React.ComponentProps<typeof TaskFrame>, "beforeExit" | "exitHref">,
) {
  const { hrefs, runner } = useMockScreen();
  return <TaskFrame {...props} beforeExit={runner.savesInFlight} exitHref={hrefs.exit} />;
}

/** "Mock exam · Half an exam day": the quiet line over the title of a step the mock's time ends. */
export function MockEyebrow() {
  const t = useExtracted();
  const shapeLabel = useMockShapeLabel();
  const { runner } = useMockScreen();
  const shape = shapeLabel(runner.view);

  return <StepEyebrow>{shape ? `${t("Mock exam")} · ${shape}` : t("Mock exam")}</StepEyebrow>;
}

/**
 * Answers that aren't stored yet, said plainly over the bar: one waiting to go out again after the
 * connection failed (it's retried on its own, or now with Retry), or one the server turned down.
 * Nothing when every answer is stored.
 */
function SaveStatusLine() {
  const t = useExtracted();
  const { runner } = useMockScreen();

  if (runner.saveStatus === "retrying") {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm" role="status">
        <span className="min-w-0 flex-1">{t("Not saved yet · retrying")}</span>
        <Button className="shrink-0" onClick={runner.retrySaves} size="sm" variant="outline">
          {t("Retry")}
        </Button>
      </p>
    );
  }

  if (runner.saveStatus === "refused") {
    return (
      <p className="text-destructive-text text-sm" role="alert">
        {t("Your last answer wasn't saved.")}
      </p>
    );
  }

  return null;
}

/**
 * Over the mock's actions: an answer that isn't stored, a step that didn't go through (it says
 * the answers are saved only when they are, and the button tries again), or a step taking longer
 * than usual.
 */
export function MockStepStatus() {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const saved = runner.saveStatus === "saved";

  return (
    <>
      <SaveStatusLine />

      {runner.error && (
        <p className="text-destructive-text text-sm" role="alert">
          {saved
            ? t("That didn't go through. Your answers are saved. Try again in a moment.")
            : t("That didn't go through. Try again in a moment.")}
        </p>
      )}

      {!runner.error && runner.slow && (
        <p className="text-muted-foreground text-sm" role="status">
          {t("Still handing it in. This is taking longer than usual.")}
        </p>
      )}
    </>
  );
}
