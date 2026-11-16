"use client";

import { Button } from "@zoonk/ui/components/button";
import { useEnterClick } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { PaperclipIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId } from "react";
import { EnterButton } from "../../_components/enter-button";
import { PageSectionTitle } from "../../_components/page";
import { type GoalError } from "../goal-errors";
import {
  OnboardingActions,
  OnboardingColumn,
  OnboardingDescription,
  OnboardingHeading,
  OnboardingTitle,
} from "../onboarding-frame";
import { useOnboardingSection } from "../onboarding-host";
import { GoalBox } from "./goal-box";
import { GoalExamples } from "./goal-examples";
import { GoalFieldSubmit, useGoalFieldAction } from "./goal-field";
import { GoalErrorAlert } from "./goal-outcomes";

/** In a section the box holds its own button; on its own page the button is the page's main action. */
function SubmitButton({ form }: { form?: string }) {
  const t = useExtracted();
  const ref = useEnterClick<HTMLButtonElement>();

  if (!form) {
    return <GoalFieldSubmit ref={ref}>{t("Build my plan")}</GoalFieldSubmit>;
  }

  return (
    <OnboardingActions>
      {/* Enter in the goal's field submits its form, so the key is the field's. */}
      <EnterButton enter="host" form={form} ref={ref} type="submit">
        {t("Build my plan")}
      </EnterButton>
    </OnboardingActions>
  );
}

export function GoalEntry({
  attachOpen,
  attachRef,
  attachment,
  canSubmitEmpty = false,
  defaultGoal,
  error,
  fromSharedPlan = false,
  onAttach,
  onSubmit,
  signUpHref,
}: {
  attachOpen?: boolean;
  attachRef?: React.Ref<HTMLButtonElement>;
  attachment?: React.ReactNode;
  canSubmitEmpty?: boolean;
  defaultGoal: string;
  error: GoalError | null;
  fromSharedPlan?: boolean;
  onAttach?: () => void;
  onSubmit: (goal: string) => void;
  signUpHref: string;
}) {
  const t = useExtracted();
  const section = useOnboardingSection();
  const formId = useId();
  const goal = useGoalFieldAction({ canSendEmpty: canSubmitEmpty, onSend: onSubmit });

  return (
    <OnboardingColumn
      bar={!section && <SubmitButton form={formId} />}
      className={cn(section && "gap-4")}
    >
      {section ? (
        <PageSectionTitle>{t("Start a goal")}</PageSectionTitle>
      ) : (
        <OnboardingHeading>
          <OnboardingTitle>{t("What's your goal?")}</OnboardingTitle>
          <OnboardingDescription>
            {fromSharedPlan
              ? t(
                  "Tell us in your own words. Your plan starts from the plan someone shared with you.",
                )
              : t("Tell us in your own words. We'll build the plan.")}
          </OnboardingDescription>
        </OnboardingHeading>
      )}

      <GoalBox defaultValue={defaultGoal} goal={goal} id={formId}>
        {onAttach && (
          <Button
            aria-expanded={attachOpen}
            aria-label={t("Study your own material")}
            className="text-muted-foreground mr-auto shrink-0 @xl:ms-0 @xl:mr-0"
            edge="start"
            onClick={onAttach}
            ref={attachRef}
            size="icon-lg"
            type="button"
            variant="ghost"
          >
            <PaperclipIcon aria-hidden="true" />
          </Button>
        )}

        {section && <SubmitButton />}
      </GoalBox>

      {attachment}

      <GoalErrorAlert error={error} signUpHref={signUpHref} />

      <GoalExamples className={cn(section && "min-[72rem]:hidden")} onPick={goal.send} />
    </OnboardingColumn>
  );
}
