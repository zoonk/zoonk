"use client";

import { type SpeakingSectionView } from "@zoonk/core/language/exam-speaking/contract";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted, useFormatter } from "next-intl";
import {
  StepCard,
  StepDetail,
  StepEyebrow,
  StepHeader,
  StepRow,
  StepRows,
  StepTitle,
} from "../_components/step-card";
import { type StepsItem } from "../_components/steps";
import { LearnLink } from "../learn-link";
import { useMockScreen } from "./mock-context";

type Estimate = SpeakingSectionView["estimate"];

/** What the exam asks of the speaking paper, as data the notice states; never a verdict. */
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

/** The paper's estimated points on its own total, or that it has none. */
function useEstimateTitle(estimate: Estimate): string {
  const t = useExtracted();
  const format = useFormatter();
  const number = (value: number) => format.number(value, { maximumFractionDigits: 1 });

  if (!hasPoints(estimate)) {
    return t("No estimate");
  }

  if (estimate.low === estimate.high) {
    return t("About {points} of {total}", {
      points: number(estimate.low),
      total: number(estimate.total),
    });
  }

  return t("About {low} to {high} of {total}", {
    high: number(estimate.high),
    low: number(estimate.low),
    total: number(estimate.total),
  });
}

/**
 * What the estimate is, or why there's none: a task was typed, which shows nothing of how the
 * candidate sounds, a task wasn't done, or a done task couldn't be graded.
 */
function useEstimateDetail({ done, estimate }: { done: boolean; estimate: Estimate }): string {
  const t = useExtracted();

  if (hasPoints(estimate)) {
    return t("An estimate, not an official score.");
  }

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

/** Each task of the paper with its feedback, which the mock kept until it was over. */
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

/**
 * The mock's speaking paper as its own step: the estimated points on the paper's own total once
 * every task is graded (never an official score) or why there's none, what the exam asks of it,
 * and each task's feedback to open now that the mock is over.
 */
function SpeakingStep({ paper }: { paper: SpeakingSectionView }) {
  const t = useExtracted();
  const done = paper.tasks.every((task) => task.status === "completed");
  const title = useEstimateTitle(paper.estimate);
  const detail = useEstimateDetail({ done, estimate: paper.estimate });
  const rule = usePassRule(paper.pass);

  return (
    <StepCard>
      <StepHeader>
        <StepEyebrow>{paper.paper}</StepEyebrow>
        <StepTitle>{title}</StepTitle>
        <StepDetail>{detail}</StepDetail>
        {/* Spoken tasks can still rate the whole paper's sound, so some typing may leave points. */}
        {paper.estimate.typed && hasPoints(paper.estimate) && (
          <StepDetail>
            {t("You typed in at least one task, so the estimate leaves out how you sounded there.")}
          </StepDetail>
        )}
        {rule && <StepDetail>{rule}</StepDetail>}
      </StepHeader>
      <SpeakingTaskRows tasks={paper.tasks} />
    </StepCard>
  );
}

/** The mock's speaking paper as a result step, once the learner started it; none otherwise. */
export function useSpeakingItems(): StepsItem[] {
  const { runner } = useMockScreen();
  const { speaking } = runner.view;

  return speaking ? [{ content: <SpeakingStep paper={speaking} />, id: "speaking" }] : [];
}
