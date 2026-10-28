"use client";

import { Button } from "@zoonk/ui/components/button";
import { useEnterClick } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { PaperclipIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId } from "react";
import { PageSectionTitle } from "../../_components/page";
import { type GoalError } from "../goal-errors";
import {
  OnboardingColumn,
  OnboardingDescription,
  OnboardingHeading,
  OnboardingTitle,
} from "../onboarding-frame";
import { useOnboardingSection } from "../onboarding-host";
import { GoalExamples } from "./goal-examples";
import {
  GoalField,
  GoalFieldLabel,
  GoalFieldSubmit,
  GoalFieldText,
  useGoalFieldAction,
} from "./goal-field";
import { GoalErrorAlert } from "./goal-outcomes";
import { useLocalGoalExample } from "./use-local-goal-example";

/** The same limit core applies to a typed goal. */
export const MAX_GOAL_LENGTH = 2000;

function SubmitButton() {
  const t = useExtracted();
  const ref = useEnterClick<HTMLButtonElement>();

  return <GoalFieldSubmit ref={ref}>{t("Build my plan")}</GoalFieldSubmit>;
}

export function GoalEntry({
  attachment,
  canSubmitEmpty = false,
  defaultGoal,
  error,
  fromSharedPlan = false,
  notice,
  onAttach,
  onSubmit,
  signUpHref,
}: {
  attachment?: React.ReactNode;
  canSubmitEmpty?: boolean;
  defaultGoal: string;
  error: GoalError | null;
  fromSharedPlan?: boolean;
  notice?: React.ReactNode;
  onAttach?: () => void;
  onSubmit: (goal: string) => void;
  signUpHref: string;
}) {
  const t = useExtracted();
  const section = useOnboardingSection();
  const example = useLocalGoalExample();
  const inputId = useId();
  const goal = useGoalFieldAction({ canSendEmpty: canSubmitEmpty, onSend: onSubmit });

  return (
    <OnboardingColumn className={cn(section && "gap-4")}>
      {section ? (
        <PageSectionTitle>{t("Start a goal")}</PageSectionTitle>
      ) : (
        <OnboardingHeading>
          <OnboardingTitle>{t("What do you want to achieve?")}</OnboardingTitle>
          <OnboardingDescription>
            {fromSharedPlan
              ? t(
                  "Tell us in your own words. Your plan starts from the plan someone shared with you.",
                )
              : t("Tell us in your own words. We'll build the plan.")}
          </OnboardingDescription>
        </OnboardingHeading>
      )}

      {notice}

      <GoalField action={goal.action} className="@container grid grid-cols-[minmax(0,1fr)_auto]">
        <div className="col-span-2 flex min-w-0 items-start gap-2 pr-2.5 @xl:col-span-1 @xl:pr-0">
          <GoalFieldLabel htmlFor={inputId}>{t("I want to")}</GoalFieldLabel>

          <GoalFieldText
            autoFocusOnPointer
            defaultValue={defaultGoal}
            id={inputId}
            maxLength={MAX_GOAL_LENGTH}
            placeholder={t(
              "{exam, select, abitur {pass the Abitur, speak {language}…} bac {pass the bac, speak {language}…} enem {pass the ENEM, speak {language}…} pau {pass the PAU, speak {language}…} other {pass the SAT, speak {language}…}}",
              example,
            )}
            {...goal.field}
          />
        </div>

        <div className="col-span-2 flex items-end justify-end gap-1 @xl:col-span-1">
          {onAttach && (
            <Button
              aria-label={t("Study your own material")}
              className="text-muted-foreground mr-auto -ml-2.5 size-11 shrink-0 @xl:mr-0 @xl:ml-0"
              onClick={onAttach}
              size="icon-lg"
              type="button"
              variant="ghost"
            >
              <PaperclipIcon aria-hidden="true" />
            </Button>
          )}

          <SubmitButton />
        </div>
      </GoalField>

      {attachment}

      <GoalErrorAlert error={error} signUpHref={signUpHref} />

      <GoalExamples className={cn(section && "min-[72rem]:hidden")} onPick={goal.send} />
    </OnboardingColumn>
  );
}
