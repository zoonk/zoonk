"use client";

import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { Eyebrow } from "../_components/eyebrow";
import { TaskFrame } from "../shell/task-frame";
import { type MockStep, useMockScreen } from "./mock-context";
import { getMockSubject } from "./mock-labels";

export function MockFrame(
  props: Omit<React.ComponentProps<typeof TaskFrame>, "beforeExit" | "exitHref" | "footerNote">,
) {
  const { hrefs, runner } = useMockScreen();
  const note = useMockStatusNote();

  return (
    <TaskFrame
      {...props}
      beforeExit={runner.savesInFlight}
      exitHref={hrefs.exit}
      footerNote={note}
    />
  );
}

export function MockEyebrow() {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const subject = getMockSubject(runner.view);

  return <Eyebrow>{subject ? `${t("Mock exam")} · ${subject}` : t("Mock exam")}</Eyebrow>;
}

function useSlowLine() {
  const t = useExtracted();

  return (step: MockStep): string => {
    if (step === "submit") {
      return t("Still handing it in. This is taking longer than usual.");
    }

    return step === "finish"
      ? t("This is taking longer than usual.")
      : t("Still starting. This is taking longer than usual.");
  };
}

/**
 * What the last save or hand-in couldn't do, drawn over the screen above the bar (its `note`)
 * so the bar's buttons never move; null when there's nothing to say.
 */
function useMockStatusNote(): React.ReactNode {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const slowLine = useSlowLine();
  const saved = runner.saveStatus === "saved";
  // A hand-in that timed out waiting on saves that keep failing is that one failure, told once.
  const failed = runner.error && runner.saveStatus !== "retrying";

  if (runner.saveStatus === "retrying") {
    return (
      <div className="flex items-center gap-2" role="status">
        <span className="text-destructive-text min-w-0 flex-1 text-start">
          {t("Try again before you move on")}
        </span>
        <Button className="shrink-0" onClick={runner.retrySaves} size="sm" variant="outline">
          {t("Try again")}
        </Button>
      </div>
    );
  }

  if (failed) {
    return (
      <p className="text-destructive-text" role="alert">
        {saved
          ? t("That didn't go through. Your answers are saved. Try again in a moment.")
          : t("That didn't go through. Try again in a moment.")}
      </p>
    );
  }

  if (runner.saveStatus === "refused") {
    return (
      <p className="text-destructive-text" role="alert">
        {t("An answer wasn't saved.")}
      </p>
    );
  }

  if (runner.slow && runner.busy) {
    return (
      <p className="text-muted-foreground" role="status">
        {slowLine(runner.busy)}
      </p>
    );
  }

  return null;
}
