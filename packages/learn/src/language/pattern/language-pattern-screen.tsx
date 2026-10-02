"use client";

import { type MistakePatternView } from "@zoonk/core/language/patterns/contract";
import { useExtracted } from "next-intl";
import { useEffect } from "react";
import { TaskFrame, TaskMainButton, TaskMainLink, TaskSaveError } from "../../shell/task-frame";
import { PatternDrillQuestion, PatternDrillResult } from "./pattern-drill";
import { PatternIntro, TyposNote } from "./pattern-intro";
import { type PatternPracticeResult, usePatternDrill } from "./use-pattern-drill";

export type { PatternPracticeResult } from "./use-pattern-drill";

/** The host saves the drill's answers through core; null when that didn't go through. */
type LanguagePatternActions = {
  /** Takes the pattern off Today without a drill, once its typos note was read. */
  dismiss: () => Promise<void>;
  practice: (answers: string[]) => Promise<PatternPracticeResult | null>;
};

const PERCENT = 100;

/** A note that the mistakes were only typos: reading it is all it asks, so it leaves Today. */
function TyposPattern({
  dismiss,
  exitHref,
  pattern,
}: {
  dismiss: () => Promise<void>;
  exitHref: string;
  pattern: MistakePatternView;
}) {
  const t = useExtracted();

  useEffect(() => {
    void dismiss();
  }, [dismiss]);

  return (
    <TaskFrame
      exitHref={exitHref}
      footer={<TaskMainLink href={exitHref}>{t("Done")}</TaskMainLink>}
      headerTitle={t("Mistake pattern")}
    >
      <TyposNote pattern={pattern} />
    </TaskFrame>
  );
}

/**
 * A mistake pattern, full screen in Focus and Fun: the card with the rule ("We noticed a
 * pattern"), a three-minute fill-in-the-blank drill one sentence at a time, and the result. A
 * pattern that was only typos gets the kind note and Done.
 *
 * ```tsx
 * <LanguagePatternScreen actions={actions} exitHref="/today" pattern={pattern} />
 * ```
 */
export function LanguagePatternScreen({
  actions,
  exitHref,
  pattern,
}: {
  actions: LanguagePatternActions;
  exitHref: string;
  pattern: MistakePatternView;
}) {
  const t = useExtracted();
  const drill = usePatternDrill({ drill: pattern.drill, practice: actions.practice });
  const { step } = drill;

  if (pattern.kind === "typos" || pattern.drill.length === 0) {
    return <TyposPattern dismiss={actions.dismiss} exitHref={exitHref} pattern={pattern} />;
  }

  if (step.kind === "result") {
    return (
      <TaskFrame
        exitHref={exitHref}
        footer={<TaskMainLink href={exitHref}>{t("Back to Today")}</TaskMainLink>}
        headerTitle={pattern.title}
      >
        <PatternDrillResult result={step.result} />
      </TaskFrame>
    );
  }

  if (step.kind === "intro" || !drill.question) {
    return (
      <TaskFrame
        exitHref={exitHref}
        footer={<TaskMainButton onClick={drill.start}>{t("Practice this · 3 min")}</TaskMainButton>}
        headerTitle={t("Mistake pattern")}
      >
        <PatternIntro pattern={pattern} />
      </TaskFrame>
    );
  }

  const isLast = drill.index + 1 === pattern.drill.length;

  const title = t("Question {current, number} of {total, number}", {
    current: drill.index + 1,
    total: pattern.drill.length,
  });

  return (
    <TaskFrame
      exitHref={exitHref}
      footer={
        <>
          {drill.failed && <TaskSaveError onRetry={drill.retry} />}
          <TaskMainButton disabled={drill.answer === null || drill.isSaving} onClick={drill.next}>
            {isLast ? t("See how you did") : t("Continue")}
          </TaskMainButton>
        </>
      }
      headerTitle={title}
      progress={{
        label: title,
        value: ((drill.index + (drill.answer === null ? 0 : 1)) / pattern.drill.length) * PERCENT,
      }}
    >
      <PatternDrillQuestion
        answer={drill.answer}
        index={drill.index}
        key={drill.index}
        onPick={drill.pick}
        question={drill.question}
      />
    </TaskFrame>
  );
}
