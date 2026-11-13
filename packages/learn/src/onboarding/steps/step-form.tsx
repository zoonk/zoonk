"use client";

import { SkipForwardIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId } from "react";
import { usePendingSender } from "../../_utils/use-pending-sender";
import {
  OnboardingActions,
  OnboardingColumn,
  OnboardingDescription,
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
  notice,
  onContinue,
  onSkip,
  pending,
  rail,
  skipIcon,
  skipLabel,
  subject,
  title,
}: {
  canContinue?: boolean;
  children?: React.ReactNode;
  continueLabel?: string;
  description?: React.ReactNode;
  /** A quiet line over the buttons, so it never moves the choices. */
  notice?: React.ReactNode;
  onContinue: () => void;
  onSkip?: () => void;
  pending: boolean;
  rail?: React.ReactNode;
  /** The second action's glyph, for one that isn't a skip. */
  skipIcon?: React.ReactNode;
  skipLabel?: string;
  subject?: string;
  title: string;
}) {
  const t = useExtracted();
  const formId = useId();
  const [sender, setSender] = usePendingSender<"continue" | "skip">(pending);

  const send = (by: "continue" | "skip", action: () => void) => {
    setSender(by);
    action();
  };

  return (
    <OnboardingColumn
      bar={
        <OnboardingActions note={notice}>
          {onSkip && (
            <OnboardingSecondaryButton
              busy={sender === "skip"}
              disabled={pending}
              icon={skipIcon ?? <SkipForwardIcon aria-hidden="true" />}
              onClick={() => send("skip", onSkip)}
            >
              {skipLabel ?? t("Skip")}
            </OnboardingSecondaryButton>
          )}

          <OnboardingPrimaryButton
            busy={sender === "continue"}
            disabled={!canContinue || pending}
            form={formId}
            type="submit"
          >
            {continueLabel ?? t("Continue")}
          </OnboardingPrimaryButton>
        </OnboardingActions>
      }
      rail={rail}
    >
      <form
        className="flex flex-1 flex-col gap-6"
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();

          if (canContinue && !pending) {
            send("continue", onContinue);
          }
        }}
      >
        <OnboardingHeading>
          {subject && <OnboardingSubject>{subject}</OnboardingSubject>}
          <OnboardingTitle>{title}</OnboardingTitle>
          {description && <OnboardingDescription>{description}</OnboardingDescription>}
        </OnboardingHeading>

        {children}
      </form>
    </OnboardingColumn>
  );
}
