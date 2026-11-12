"use client";

import { FORWARD_ICON } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { SkipForwardIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { CLEAR_OF_PINNED_ACTIONS_CLASS } from "../../_components/pinned-actions";
import { usePendingSender } from "../../_utils/use-pending-sender";
import {
  OnboardingColumn,
  OnboardingDescription,
  OnboardingFooter,
  OnboardingHeading,
  OnboardingPrimaryButton,
  OnboardingSecondaryButton,
  OnboardingSubject,
  OnboardingTitle,
} from "../onboarding-frame";

export function StepForm({
  canContinue = true,
  children,
  continueLabel,
  description,
  formNoValidate,
  notice,
  onContinue,
  onSkip,
  pending,
  rail,
  skipLabel,
  subject,
  title,
}: {
  canContinue?: boolean;
  children?: React.ReactNode;
  continueLabel?: string;
  description?: React.ReactNode;
  formNoValidate?: boolean;
  /** A quiet line above the buttons, so it never moves the choices. */
  notice?: React.ReactNode;
  onContinue: () => void;
  onSkip?: () => void;
  pending: boolean;
  rail?: React.ReactNode;
  skipLabel?: string;
  subject?: string;
  title: string;
}) {
  const t = useExtracted();
  const [sender, setSender] = usePendingSender<"continue" | "skip">(pending);

  const send = (by: "continue" | "skip", action: () => void) => {
    setSender(by);
    action();
  };

  return (
    <OnboardingColumn rail={rail}>
      <form
        className="flex flex-1 flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();

          if (canContinue && !pending) {
            send("continue", onContinue);
          }
        }}
      >
        <div className={cn("contents", CLEAR_OF_PINNED_ACTIONS_CLASS)}>
          <OnboardingHeading>
            {subject && <OnboardingSubject>{subject}</OnboardingSubject>}
            <OnboardingTitle>{title}</OnboardingTitle>
            {description && <OnboardingDescription>{description}</OnboardingDescription>}
          </OnboardingHeading>

          {children}
        </div>

        <OnboardingFooter pinned>
          {notice}
          <OnboardingPrimaryButton
            busy={sender === "continue"}
            disabled={!canContinue || pending}
            formNoValidate={formNoValidate}
            type="submit"
            {...FORWARD_ICON}
          >
            {continueLabel ?? t("Continue")}
          </OnboardingPrimaryButton>

          {onSkip && (
            <OnboardingSecondaryButton
              busy={sender === "skip"}
              disabled={pending}
              icon={<SkipForwardIcon aria-hidden="true" />}
              onClick={() => send("skip", onSkip)}
              type="button"
            >
              {skipLabel ?? t("Skip")}
            </OnboardingSecondaryButton>
          )}
        </OnboardingFooter>
      </form>
    </OnboardingColumn>
  );
}
