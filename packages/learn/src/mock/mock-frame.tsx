"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { Eyebrow } from "../_components/eyebrow";
import { TaskFrame } from "../shell/task-frame";
import { useMockScreen } from "./mock-context";
import { getMockSubject } from "./mock-labels";

export function MockFrame(
  props: Omit<React.ComponentProps<typeof TaskFrame>, "beforeExit" | "exitHref">,
) {
  const { hrefs, runner } = useMockScreen();
  return <TaskFrame {...props} beforeExit={runner.savesInFlight} exitHref={hrefs.exit} />;
}

export function MockEyebrow() {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const subject = getMockSubject(runner.view);

  return <Eyebrow>{subject ? `${t("Mock exam")} · ${subject}` : t("Mock exam")}</Eyebrow>;
}

function SaveStatusLine({ reserve }: { reserve: boolean }) {
  const t = useExtracted();
  const { runner } = useMockScreen();

  const retrying = runner.saveStatus === "retrying";

  if (retrying || reserve) {
    return (
      <div
        className={cn("flex items-center gap-2 text-sm", !retrying && "invisible")}
        role="status"
      >
        <span className="text-destructive-text min-w-0 flex-1">
          {t("Try again before you move on")}
        </span>
        <Button className="shrink-0" onClick={runner.retrySaves} size="sm" variant="outline">
          {t("Try again")}
        </Button>
      </div>
    );
  }

  return null;
}

export function MockStepStatus({ reserve = false }: { reserve?: boolean }) {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const saved = runner.saveStatus === "saved";
  // A hand-in that timed out waiting on saves that keep failing is that one failure, told once.
  const failed = runner.error && runner.saveStatus !== "retrying";

  const status = (
    <>
      <SaveStatusLine reserve={reserve} />

      {runner.saveStatus === "refused" && !failed && (
        <p className="text-destructive-text self-center text-sm" role="alert">
          {t("Your last answer wasn't saved.")}
        </p>
      )}

      {failed && (
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

  return reserve ? <div className="grid w-full *:col-start-1 *:row-start-1">{status}</div> : status;
}
