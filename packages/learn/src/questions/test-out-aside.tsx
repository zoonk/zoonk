"use client";

import { BookOpenIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { StepRow, StepRows } from "../_components/step-card";
import { type TaskFrameAside } from "../shell/task-frame";

const PERCENT = 100;

export function useTestOutRule(passMark: number): string {
  const t = useExtracted();

  return t("{passMark, number}% right skips the chapter. No feedback until the end.", {
    passMark: Math.round(passMark * PERCENT),
  });
}

export function useTestOutAside({
  chapterTitle,
  lessonsLeft,
  rule,
}: {
  chapterTitle: string;
  lessonsLeft: number | null;
  rule: string;
}): TaskFrameAside {
  const t = useExtracted();

  return {
    children: (
      <>
        <StepRows>
          <StepRow>
            <BookOpenIcon aria-hidden="true" />
            <span className="min-w-0 flex-1 font-medium text-pretty">{chapterTitle}</span>
            {lessonsLeft !== null && lessonsLeft > 0 && (
              <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
                {t("{count, plural, one {# lesson left} other {# lessons left}}", {
                  count: lessonsLeft,
                })}
              </span>
            )}
          </StepRow>
        </StepRows>

        <p className="text-muted-foreground text-[0.8125rem] leading-5 text-pretty">{rule}</p>
      </>
    ),
    label: t("What a pass skips"),
    title: t("What a pass skips"),
  };
}
