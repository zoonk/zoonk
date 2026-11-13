"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { UserRoundPlusIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { LearnLink } from "../../learn-link";
import { type OnboardingRoutes } from "../onboarding-actions";
import {
  ONBOARDING_ACTION_LINK_CLASS,
  OnboardingColumn,
  OnboardingDescription,
  OnboardingActions,
  OnboardingHeading,
  OnboardingTitle,
} from "../onboarding-frame";
import { StepIcon } from "../steps/step-parts";
import { SignUpLink } from "./goal-outcomes";

export function GuestGoalGate({ routes }: { routes: OnboardingRoutes }) {
  const t = useExtracted();

  return (
    <OnboardingColumn
      bar={
        <OnboardingActions>
          <LearnLink className={ONBOARDING_ACTION_LINK_CLASS.other} href={routes.today}>
            {t("Back to Today")}
          </LearnLink>
          <SignUpLink href={routes.signUp} />
        </OnboardingActions>
      }
    >
      <StepIcon>
        <UserRoundPlusIcon />
      </StepIcon>
      <OnboardingHeading>
        <OnboardingTitle>{t("Create a free account to start another goal")}</OnboardingTitle>
        <OnboardingDescription>
          {t({
            description:
              "Creating an account keeps the plan and progress the learner made as a guest.",
            message:
              "Without an account, you can follow one goal. Your plan and progress come with you.",
          })}
        </OnboardingDescription>
      </OnboardingHeading>
    </OnboardingColumn>
  );
}
