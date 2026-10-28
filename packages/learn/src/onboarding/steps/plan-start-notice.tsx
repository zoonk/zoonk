"use client";

import { Alert, AlertDescription, AlertTitle } from "@zoonk/ui/components/alert";
import { Button } from "@zoonk/ui/components/button";
import { CircleAlertIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type ReactNode, createContext, use } from "react";
import { type GenerationRun } from "../../generation/generation-run";

const PlanRunContext = createContext<GenerationRun | null | undefined>(undefined);

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
 * In the footer, so a notice never moves the choices under the learner's finger; the live region
 * stays while empty, so it's heard when it comes.
 */
export function PlanStartNoticeSlot() {
  const run = use(PlanRunContext);

  if (run === undefined) {
    return null;
  }

  return <div aria-live="polite">{run && <PlanStartNotice run={run} />}</div>;
}

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
