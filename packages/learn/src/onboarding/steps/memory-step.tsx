"use client";

import { type OnboardingAnswerInput } from "@zoonk/core/view-models/onboarding/contract";
import { BrainIcon, SettingsIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { StepForm } from "./step-form";

function MemoryStepRow({ children, icon }: { children: React.ReactNode; icon: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 text-sm">
      {icon}
      <p>{children}</p>
    </div>
  );
}

/**
 * Memory starts off for learners under 18 and anyone who didn't tell us their age, so onboarding
 * asks them once, in plain words, whether to turn it on. "Not now" keeps it off, and nothing asks
 * again: Settings is where they change their mind. A teen is told they can ask an adult first.
 */
export function MemoryStep({
  isMinor,
  onAnswer,
  pending,
}: {
  isMinor: boolean;
  onAnswer: (input: OnboardingAnswerInput) => void;
  pending: boolean;
}) {
  const t = useExtracted();

  return (
    <StepForm
      continueLabel={t("Yes, personalize them")}
      description={
        isMinor
          ? t("It stays off unless you say yes. Not sure? Ask a parent or guardian.")
          : t("It stays off unless you say yes.")
      }
      onContinue={() => onAnswer({ enabled: true, question: "memory" })}
      onSkip={() => onAnswer({ enabled: false, question: "memory" })}
      pending={pending}
      skipLabel={t("Not now")}
      title={t("Use what you tell us to personalize your lessons?")}
    >
      <div className="flex flex-col gap-4">
        <MemoryStepRow
          icon={
            <BrainIcon
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-violet-600 dark:text-violet-400"
            />
          }
        >
          {t(
            "We remember your goals and how you learn, like what you find hard, to write examples that fit you.",
          )}
        </MemoryStepRow>

        <MemoryStepRow
          icon={
            <SettingsIcon
              aria-hidden="true"
              className="text-muted-foreground mt-0.5 size-5 shrink-0"
            />
          }
        >
          {t("You can see what we remember, delete it or turn it off anytime in Settings.")}
        </MemoryStepRow>
      </div>
    </StepForm>
  );
}
