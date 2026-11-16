"use client";

import { MAX_GOAL_PROMPT_LENGTH } from "@zoonk/core/goals/goal-input-limits";
import { useExtracted } from "next-intl";
import { useId } from "react";
import { GoalField, GoalFieldLabel, GoalFieldText, type useGoalFieldAction } from "./goal-field";
import { useLocalGoalExample } from "./use-local-goal-example";

type GoalAction = ReturnType<typeof useGoalFieldAction>;

/**
 * The box a goal is typed in on every app page that starts one (Today, the Plan, the buddy): "I want
 * to", an example from the learner's own country, then the box's own controls (`children`), which
 * take the line under the words when the box is narrow.
 */
export function GoalBox({
  children,
  defaultValue,
  goal,
  id,
}: {
  children?: React.ReactNode;
  defaultValue?: string;
  goal: Pick<GoalAction, "action" | "field">;
  /** The form's id, for a submit button drawn outside the box. */
  id?: string;
}) {
  const t = useExtracted();
  const example = useLocalGoalExample();
  const inputId = useId();

  return (
    <GoalField
      action={goal.action}
      className="@container grid grid-cols-[minmax(0,1fr)_auto]"
      id={id}
    >
      <div className="col-span-2 flex min-w-0 items-start gap-2 pr-2.5 @xl:col-span-1 @xl:pr-0">
        <GoalFieldLabel htmlFor={inputId}>{t("I want to")}</GoalFieldLabel>

        <GoalFieldText
          autoFocusOnPointer
          defaultValue={defaultValue}
          id={inputId}
          maxLength={MAX_GOAL_PROMPT_LENGTH}
          placeholder={t({
            description:
              "Each branch names its own exam as people there call it (共通テスト, 수능): keep that exam in it, never another country's.",
            message:
              "{exam, select, abitur {pass the Abitur, speak {language}…} bac {pass the bac, speak {language}…} enem {pass the ENEM, speak {language}…} exani {pass the EXANI-II, speak {language}…} kyotsu {do well on the Common Test, speak {language}…} matura {pass the matura, speak {language}…} maturita {pass the maturità, speak {language}…} suneung {do well on the CSAT, speak {language}…} yks {do well on the YKS, speak {language}…} other {pass the SAT, speak {language}…}}",
            values: example,
          })}
          {...goal.field}
        />
      </div>

      <div className="col-span-2 flex items-center justify-end gap-1 empty:hidden @xl:col-span-1">
        {children}
      </div>
    </GoalField>
  );
}
