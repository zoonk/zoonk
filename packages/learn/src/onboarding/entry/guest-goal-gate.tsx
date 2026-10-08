"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { UserRoundPlusIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { LearnLink } from "../../learn-link";
import { type OnboardingRoutes } from "../onboarding-actions";
import {
  OnboardingColumn,
  OnboardingDescription,
  OnboardingFooter,
  OnboardingHeading,
  OnboardingTitle,
} from "../onboarding-frame";
import { StepIcon } from "../steps/step-parts";
import { SignUpLink } from "./goal-outcomes";

/**
 * A guest whose one goal is taken, before they type another: only an account adds one, so they're
 * asked first instead of after waiting for words that can't become a goal. Their plan comes with
 * them when they sign up.
 */
export function GuestGoalGate({ routes }: { routes: OnboardingRoutes }) {
  const t = useExtracted();

  return (
    <OnboardingColumn>
      <StepIcon>
        <UserRoundPlusIcon />
      </StepIcon>
      <OnboardingHeading>
        <OnboardingTitle>{t("Create a free account to start another goal")}</OnboardingTitle>
        <OnboardingDescription>
          {t("Without an account, you can follow one goal. Your plan and progress come with you.")}
        </OnboardingDescription>
      </OnboardingHeading>

      <OnboardingFooter>
        <SignUpLink href={routes.signUp} />
        <LearnLink
          className={cn(buttonVariants({ size: "lg", variant: "ghost" }), "h-12 w-full text-base")}
          href={routes.today}
        >
          {t("Back to Today")}
        </LearnLink>
      </OnboardingFooter>
    </OnboardingColumn>
  );
}
