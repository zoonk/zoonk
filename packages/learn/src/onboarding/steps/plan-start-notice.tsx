"use client";

import { Alert, AlertDescription, AlertTitle } from "@zoonk/ui/components/alert";
import { Button } from "@zoonk/ui/components/button";
import { CircleAlertIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type GenerationRun } from "../../generation/generation-run";

/**
 * Shown above the questions when the plan being built in the background couldn't start or
 * stopped: the answers are safe, and starting it again now means it's ready when they finish. A
 * lost connection waits for the screens that show the plan's progress.
 */
export function PlanStartNotice({ run }: { run: GenerationRun }) {
  const t = useExtracted();

  if (run.status !== "failed" || run.failure === "connection") {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-2">
      <Alert className="in-data-[mode=fun]:fun-glass" variant="destructive">
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
    </div>
  );
}
