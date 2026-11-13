"use client";

import { type SpeakingSectionView } from "@zoonk/core/language/exam-speaking/contract";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted, useFormatter } from "next-intl";
import {
  StepCard,
  StepDetail,
  StepHeader,
  StepRow,
  StepRows,
  StepTitle,
  StepTitleLabel,
  StepTitleNumber,
  renderStepNumber,
} from "../_components/step-card";
import { type StepsItem } from "../_components/steps";
import { LearnLink } from "../learn-link";
import { useMockScreen } from "./mock-context";

type Estimate = SpeakingSectionView["estimate"];

function usePassRule(pass: SpeakingSectionView["pass"]): string | null {
  const t = useExtracted();

  switch (pass.kind) {
    case "group":
      return t(
        "The exam asks for at least {min, number} of {of, number} on this paper and listening together.",
        pass,
      );
    case "paper":
      return t("The exam asks for at least {min, number} on this paper.", pass);
    case "floor":
      return t("Below {min, number} on this paper, the whole exam isn't passed.", pass);
    case "none":
      return null;
    default:
      return null;
  }
}

function hasPoints(estimate: Estimate): estimate is Estimate & { high: number; low: number } {
  return estimate.complete && estimate.low !== null && estimate.high !== null;
}

function useEstimateRange(estimate: Estimate): string | null {
  const t = useExtracted();
  const format = useFormatter();
  const number = (value: number) => format.number(value, { maximumFractionDigits: 1 });

  if (!hasPoints(estimate)) {
    return null;
  }

  return estimate.low === estimate.high
    ? number(estimate.low)
    : t("{low}–{high}", { high: number(estimate.high), low: number(estimate.low) });
}

/** Why a paper has no estimate. */
function useNoEstimateReason({ done, estimate }: { done: boolean; estimate: Estimate }): string {
  const t = useExtracted();

  if (!done) {
    return t("Not every task was done, so there's no estimate for this paper.");
  }

  if (estimate.typed) {
    return t(
      "You typed in at least one task, and typing shows nothing of how you sound, so the speaking part has no estimate. Speak every task next time to get one.",
    );
  }

  return t("A task couldn't be graded, so the speaking part has no estimate.");
}

function SpeakingTaskRows({ tasks }: { tasks: SpeakingSectionView["tasks"] }) {
  const t = useExtracted();
  const { hrefs } = useMockScreen();

  return (
    <StepRows aria-label={t("Tasks")}>
      {tasks.map((task) => (
        <StepRow key={task.key}>
          <span className="min-w-0 flex-1 text-pretty">{task.name}</span>

          {task.status === "completed" ? (
            <LearnLink
              className={cn(buttonVariants({ size: "sm", variant: "outline" }), "shrink-0")}
              href={hrefs.speakingTask(task.conversationId)}
            >
              {t("See feedback")}
            </LearnLink>
          ) : (
            <span className="text-muted-foreground shrink-0">{t("Not done")}</span>
          )}
        </StepRow>
      ))}
    </StepRows>
  );
}

function SpeakingStep({ paper }: { paper: SpeakingSectionView }) {
  const t = useExtracted();
  const done = paper.tasks.every((task) => task.status === "completed");
  const range = useEstimateRange(paper.estimate);
  const format = useFormatter();
  const noEstimate = useNoEstimateReason({ done, estimate: paper.estimate });
  const rule = usePassRule(paper.pass);

  return (
    <StepCard>
      <StepHeader>
        <StepTitle className="flex flex-col items-start gap-1.5">
          <StepTitleLabel>{paper.paper}</StepTitleLabel>
          {range ? <StepTitleNumber>{range}</StepTitleNumber> : t("No estimate")}
        </StepTitle>
        <StepDetail className="text-sm">
          {range
            ? t.rich("Estimated score, from <mono>0</mono> to <mono>{max}</mono>", {
                max: format.number(paper.estimate.total),
                mono: renderStepNumber,
              })
            : noEstimate}
        </StepDetail>
        {paper.estimate.typed && hasPoints(paper.estimate) && (
          <StepDetail className="text-sm">
            {t("You typed in at least one task, so the estimate leaves out how you sounded there.")}
          </StepDetail>
        )}
        {rule && <StepDetail className="text-sm">{rule}</StepDetail>}
      </StepHeader>
      <SpeakingTaskRows tasks={paper.tasks} />
    </StepCard>
  );
}

export function useSpeakingItems(): StepsItem[] {
  const { runner } = useMockScreen();
  const { speaking } = runner.view;

  return speaking ? [{ content: <SpeakingStep paper={speaking} />, id: "speaking" }] : [];
}
