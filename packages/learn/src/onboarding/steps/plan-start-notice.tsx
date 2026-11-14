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

/** The plan's build that failed, while the steps go on; a lost connection says itself elsewhere. */
export function usePlanStartFailure(): GenerationRun | null {
  const run = use(PlanRunContext);
  return run?.status === "failed" && run.failure !== "connection" ? run : null;
}

export function PlanStartNotice({ run }: { run: GenerationRun }) {
  const t = useExtracted();

  return (
    <Alert variant="destructive">
      <CircleAlertIcon aria-hidden="true" />
      <AlertTitle>
        {run.failure === "notStarted"
          ? t("Your plan didn't start")
          : t("Building your plan stopped")}
      </AlertTitle>
      <AlertDescription>{t("Your answers are saved.")}</AlertDescription>
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
