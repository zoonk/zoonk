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
import { useLocalGoalExample } from "./use-local-goal-example";

type GoalExample = { kind: string; label: string };

function useGoalExamples(): GoalExample[] {
  const t = useExtracted();
  const quickExplanation = useQuickExplanationLabel();
  const { exam, language } = useLocalGoalExample();

  return [
    {
      kind: t("Exam"),
      label: t({
        description:
          "Each branch names its own exam: keep that exam in it, never another country's.",
        message:
          "{exam, select, abitur {Pass the Abitur} bac {Pass the bac} enem {Pass the ENEM} pau {Pass the PAU} other {Pass the SAT}}",
        values: { exam },
      }),
    },
    { kind: t("Language"), label: t("Speak {language} for a job interview", { language }) },
    { kind: t("Learn a topic"), label: t("Understand quantum physics") },
    { kind: t("Music"), label: t("Learn music from scratch") },
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
              <ListRowDescription>{example.kind}</ListRowDescription>
            </ListRowContent>
          </ListRowButton>
        ))}
      </ListGroup>
    </section>
  );
}
