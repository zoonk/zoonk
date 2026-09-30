"use client";

import {
  type ExplanationStepName,
  type GoalContentStepName,
} from "@zoonk/core/library/generation/steps";
import { Button } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { cn } from "@zoonk/ui/lib/utils";
import { CircleAlertIcon, CircleCheckIcon, CircleDashedIcon } from "lucide-react";
import { useExtracted } from "next-intl";

type GenerationStep = ExplanationStepName | GoalContentStepName;

/**
 * Where the run writing a goal's curriculum (or a quick explanation) stands, as its live stream
 * reported it: `waiting` until the run is known, `following` while it reports steps, then
 * `ready` or `failed`. The host follows the stream; these screens only show it.
 */
export type GenerationProgress = {
  /** Starts the run again after it failed. */
  retry?: () => void;
  status: "failed" | "following" | "ready" | "waiting";
  /** The latest status of each step the run reported. */
  steps: Partial<Record<GenerationStep, "completed" | "started">>;
};

const CURRICULUM_STEPS = [
  "understandGoal",
  "buildSkillGraph",
  "saveSkills",
  "createPlan",
  "outlineCourses",
  "prepareFirstLessons",
] as const satisfies GoalContentStepName[];

const EXPLANATION_STEPS = [
  "classifyQuestion",
  "findExplanation",
  "writeExplanation",
] as const satisfies ExplanationStepName[];

type RowState = "current" | "done" | "stopped" | "upcoming";

/**
 * Only what the run reported: a step is done once it completed or a later one began, the latest
 * one it began is in progress, and the rest haven't started.
 */
function getRowStates(order: readonly GenerationStep[], progress: GenerationProgress): RowState[] {
  if (progress.status === "ready") {
    return order.map(() => "done");
  }

  // Before its first event, a followed run is on its first step.
  const latest = Math.max(
    order.findLastIndex((step) => progress.steps[step] !== undefined),
    0,
  );

  return order.map((step, index) => {
    if (progress.steps[step] === "completed" || index < latest) {
      return "done";
    }

    if (index === latest) {
      return progress.status === "failed" ? "stopped" : "current";
    }

    return "upcoming";
  });
}

function useStepLabels(): Record<GenerationStep, string> {
  const t = useExtracted();

  return {
    buildSkillGraph: t("Mapping the skills it takes"),
    classifyQuestion: t("Reading your question"),
    createPlan: t("Fitting the plan into your days"),
    explanationReady: t("Ready"),
    findExplanation: t("Checking if someone asked it before"),
    goalReady: t("Ready"),
    joinRunningExplanation: t("Reading your question"),
    joinRunningGoal: t("Reading your goal"),
    outlineCourses: t("Outlining your courses"),
    prepareFirstLessons: t("Getting your first lessons ready"),
    preparePlacement: t("Writing your questions"),
    readExamNotice: t("Reading your material"),
    saveSkills: t("Matching them with lessons in the Library"),
    understandGoal: t("Reading your goal"),
    writeExplanation: t("Writing about 5 short screens"),
  };
}

function RowIcon({ state }: { state: RowState }) {
  switch (state) {
    case "done":
      return <CircleCheckIcon aria-hidden="true" className="text-success size-4 shrink-0" />;
    case "current":
      return <Spinner className="size-4 shrink-0" />;
    case "stopped":
      return <CircleAlertIcon aria-hidden="true" className="text-destructive size-4 shrink-0" />;
    case "upcoming":
      return (
        <CircleDashedIcon
          aria-hidden="true"
          className="text-muted-foreground/60 in-data-[mode=fun]:text-fun-fg2 size-4 shrink-0"
        />
      );
    default:
      return null;
  }
}

/**
 * The run's steps as they happen, in plain words: done, in progress and still to come. When the
 * run fails, it says so and offers to start it again.
 */
export function GenerationSteps({
  className,
  kind,
  progress,
}: {
  className?: string;
  kind: "curriculum" | "explanation";
  progress: GenerationProgress;
}) {
  const t = useExtracted();
  const labels = useStepLabels();
  const order = kind === "curriculum" ? CURRICULUM_STEPS : EXPLANATION_STEPS;
  const states = getRowStates(order, progress);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <ol aria-label={t("Progress")} aria-live="polite" className="flex flex-col gap-3">
        {order.map((step, index) => {
          const state = states[index] ?? "upcoming";

          return (
            <li
              className={cn(
                "flex items-center gap-3 text-sm",
                state === "upcoming" && "text-muted-foreground in-data-[mode=fun]:text-fun-fg2",
                state === "current" && "font-medium",
              )}
              data-state={state}
              key={step}
            >
              <RowIcon state={state} />
              {labels[step]}
            </li>
          );
        })}
      </ol>

      {progress.status === "failed" && (
        <div className="flex flex-col items-start gap-3" role="alert">
          <p className="text-muted-foreground text-sm">
            {t("Something went wrong while we were writing this.")}
          </p>
          {progress.retry && (
            <Button onClick={progress.retry} size="sm" variant="outline">
              {t("Try again")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
