"use client";

import { type ExamChoiceView } from "@zoonk/core/exams/choices/contract";
import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useId } from "react";
import { usePickedNames } from "./use-picked-names";

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
  const picked = usePickedNames(choice);

  if (!picked) {
    return null;
  }

  return (
    <p
      className={cn("text-muted-foreground text-sm text-pretty", className)}
      data-slot="plan-choice-line"
    >
      <span id={id}>{t("{group}: {option}", { group: choice.group, option: picked })}</span>
      <span aria-hidden="true">{"\u00A0·\u00A0"}</span>
      <Button aria-describedby={id} onClick={onChange} variant="link">
        {t("Change")}
      </Button>
    </p>
  );
}

/** Which option of each exam choice the plan follows. */
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
