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

/** Only a quick explanation says what it is: the other examples' own words already do. */
type GoalExample = { kind?: string; label: string };

/** The one set of example goals, a learner's own exam and language first. */
export function useGoalExamples(): GoalExample[] {
  const t = useExtracted();
  const quickExplanation = useQuickExplanationLabel();
  const { language } = useLocalGoalExample();
  const exam = useLocalExamGoal();

  return [
    { label: exam },
    { label: t("Speak {language} for a job interview", { language }) },
    { label: t("Understand quantum physics") },
    { label: t("Learn music from scratch") },
    { kind: quickExplanation, label: t("How does inflation work?") },
  ];
}

export function GoalExamples({
  className,
  onPick,
}: {
  className?: string;
  onPick: (goal: string) => void;
}) {
  const t = useExtracted();
  const examples = useGoalExamples();
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className={cn("flex flex-col gap-1", className)}>
      <PageSectionTitle id={titleId}>{t("Examples")}</PageSectionTitle>

      <ListGroup>
        {examples.map((example) => (
          <ListRowButton key={example.label} onClick={() => onPick(example.label)}>
            <ListRowContent>
              <ListRowTitle>{example.label}</ListRowTitle>
              {example.kind && <ListRowDescription>{example.kind}</ListRowDescription>}
            </ListRowContent>
          </ListRowButton>
        ))}
      </ListGroup>
    </section>
  );
}
