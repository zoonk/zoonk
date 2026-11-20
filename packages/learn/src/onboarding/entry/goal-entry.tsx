"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { PaperclipIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId } from "react";
import { PageSectionTitle } from "../../_components/page";
import { FreeStartNote } from "../free-start-note";
import { type GoalError } from "../goal-errors";
import {
  OnboardingColumn,
  OnboardingDescription,
  OnboardingHeading,
  OnboardingTitle,
} from "../onboarding-frame";
import { useOnboardingHost } from "../onboarding-host";
import { GoalBox } from "./goal-box";
import { GoalEntrySubmit } from "./goal-entry-submit";
import { GoalExamples } from "./goal-examples";
import { useGoalFieldAction } from "./goal-field";
import { GoalErrorAlert } from "./goal-outcomes";

export function GoalEntry({
  attachOpen,
  attachRef,
  attachment,
  canSubmitEmpty = false,
  defaultGoal,
  error,
  fromSharedPlan = false,
  hasAccount,
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
  hasAccount: boolean;
  onAttach?: () => void;
  onSubmit: (goal: string) => void;
  signUpHref: string;
}) {
  const t = useExtracted();
  const host = useOnboardingHost();
  const section = host?.kind === "section";
  const formId = useId();

  const goal = useGoalFieldAction({
    canSendEmpty: canSubmitEmpty,
    defaultValue: defaultGoal,
    onSend: onSubmit,
  });

  return (
    <OnboardingColumn
      bar={!section && <GoalEntrySubmit disabled={goal.disabled} form={formId} />}
      className={cn(section && "gap-4")}
    >
      {section ? (
        <PageSectionTitle className={host.titleClassName}>{t("Start a goal")}</PageSectionTitle>
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
            className="text-muted-foreground me-auto shrink-0 @xl:ms-0 @xl:me-0"
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

        {section && <GoalEntrySubmit disabled={goal.disabled} />}
      </GoalBox>

      {section && !hasAccount && <FreeStartNote className="min-[72rem]:hidden" />}

      {attachment}

      <GoalErrorAlert error={error} signUpHref={signUpHref} />

      <GoalExamples className={cn(section && "min-[72rem]:hidden")} onPick={goal.send} />
    </OnboardingColumn>
  );
}
