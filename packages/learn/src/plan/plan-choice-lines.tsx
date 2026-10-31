"use client";

import { type ExamChoiceView } from "@zoonk/core/exams/choices/contract";
import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useId } from "react";
import { useChoiceLeftOutLine } from "../_utils/use-choice-left-out";

function PlanChoiceLine({
  choice,
  className,
  onChange,
}: {
  choice: ExamChoiceView;
  className?: string;
  onChange: () => void;
}) {
  const t = useExtracted();
  const id = useId();
  const leftOutLine = useChoiceLeftOutLine();
  const picked = choice.options.find((option) => option.name === choice.subject);

  return (
    <p
      className={cn("text-muted-foreground text-sm text-pretty", className)}
      data-slot="plan-choice-line"
    >
      <span id={id}>
        {picked
          ? t({
              description:
                "{option} is the option of an exam's choice the learner's plan studies, such as a specialty (Desenvolvimento de Sistemas) or a foreign language, named as the exam's notice names it",
              message: "Following the {option} syllabus",
              values: { option: picked.shortName ?? picked.name },
            })
          : leftOutLine(choice)}
      </span>
      {picked ? <span aria-hidden="true">{"\u00A0·\u00A0"}</span> : " "}
      <Button aria-describedby={id} onClick={onChange} variant="link">
        {picked ? t("Change") : t("Choose")}
      </Button>
    </p>
  );
}

/** Which option of each exam choice the plan follows, or what it leaves out until one is picked. */
export function PlanChoiceLines({
  choices,
  className,
  onChange,
}: {
  choices: ExamChoiceView[];
  className?: string;
  onChange: () => void;
}) {
  return choices.map((choice) => (
    <PlanChoiceLine choice={choice} className={className} key={choice.group} onChange={onChange} />
  ));
}
