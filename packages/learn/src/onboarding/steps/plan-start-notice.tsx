"use client";

import { Alert, AlertDescription, AlertTitle } from "@zoonk/ui/components/alert";
import { Button } from "@zoonk/ui/components/button";
import { CircleAlertIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type ReactNode, createContext, use } from "react";
import { type GenerationRun } from "../../generation/generation-run";

/** The plan's background run while the questions show; null on screens that don't say how it goes. */
const PlanRunContext = createContext<GenerationRun | null | undefined>(undefined);

/** The run the questions' footer reports on (`PlanStartNoticeSlot`), when it stops. */
export function PlanStartNoticeProvider({
  children,
  run,
}: {
  children: ReactNode;
  run: GenerationRun | null;
}) {
  return <PlanRunContext value={run}>{children}</PlanRunContext>;
}

/**
 * Where a question screen says its plan stopped building: in its footer, over Continue, so a
 * notice that arrives while the learner answers never moves the choices under their finger, and
 * Try again sits beside the step they'd take next. The live region stays rendered while empty, so
 * screen readers hear it when it comes, wherever the page is scrolled. Nothing outside the
 * questions' flow.
 */
export function PlanStartNoticeSlot() {
  const run = use(PlanRunContext);

  if (run === undefined) {
    return null;
  }

  return <div aria-live="polite">{run && <PlanStartNotice run={run} />}</div>;
}

/**
 * When the plan being built in the background couldn't start or stopped: the answers are safe,
 * and starting it again now means it's ready when they finish. A lost connection waits for the
 * screens that show the plan's progress.
 */
function PlanStartNotice({ run }: { run: GenerationRun }) {
  const t = useExtracted();

  if (run.status !== "failed" || run.failure === "connection") {
    return null;
  }

  return (
    <Alert variant="destructive">
      <CircleAlertIcon aria-hidden="true" />
      <AlertTitle>
        {run.failure === "notStarted"
          ? t("We couldn't start building your plan")
          : t("Building your plan stopped")}
      </AlertTitle>
      <AlertDescription>
        {t("Your answers are saved. Try again so it's ready when you finish.")}
      </AlertDescription>
      {run.retry && (
        <Button
          className="text-foreground col-start-2 mt-3 justify-self-start"
          onClick={run.retry}
          size="sm"
          variant="outline"
        >
          {t("Try again")}
        </Button>
      )}
    </Alert>
  );
}
