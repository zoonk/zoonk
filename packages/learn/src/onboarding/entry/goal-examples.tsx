"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useId } from "react";
import {
  ListGroup,
  ListRowButton,
  ListRowContent,
  ListRowDescription,
  ListRowTitle,
} from "../../_components/list-group";
import { PageSectionTitle } from "../../_components/page";
import { useQuickExplanationLabel } from "../../explain/quick-explanation-label";
import { useLocalExamGoal, useLocalGoalExample } from "./use-local-goal-example";

type GoalExample = { kind: string; label: string };

function useGoalExamples(explanationsOnly: boolean): GoalExample[] {
  const t = useExtracted();
  const quickExplanation = useQuickExplanationLabel();
  const { language } = useLocalGoalExample();
  const exam = useLocalExamGoal();

  if (explanationsOnly) {
    return [
      { kind: quickExplanation, label: t("How does inflation work?") },
      { kind: quickExplanation, label: t("Why is the sky blue?") },
      { kind: quickExplanation, label: t("What is compound interest?") },
    ];
  }

  return [
    { kind: t("Exam"), label: exam },
    { kind: t("Language"), label: t("Speak {language} for a job interview", { language }) },
    { kind: t("Learn a topic"), label: t("Understand quantum physics") },
    { kind: t("Music"), label: t("Learn music from scratch") },
    { kind: quickExplanation, label: t("How does inflation work?") },
  ];
}

export function GoalExamples({
  className,
  explanationsOnly = false,
  onPick,
}: {
  className?: string;
  /** A learner at their goal limit can still ask for an explanation, so only those are offered. */
  explanationsOnly?: boolean;
  onPick: (goal: string) => void;
}) {
  const t = useExtracted();
  const examples = useGoalExamples(explanationsOnly);
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className={cn("flex flex-col gap-1", className)}>
      <PageSectionTitle id={titleId}>{t("Examples")}</PageSectionTitle>

      <ListGroup>
        {examples.map((example) => (
          <ListRowButton key={example.label} onClick={() => onPick(example.label)}>
            <ListRowContent>
              <ListRowTitle>{example.label}</ListRowTitle>
              <ListRowDescription>{example.kind}</ListRowDescription>
            </ListRowContent>
          </ListRowButton>
        ))}
      </ListGroup>
    </section>
  );
}
