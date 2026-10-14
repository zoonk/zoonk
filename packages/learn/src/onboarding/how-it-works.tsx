"use client";

import { useExtracted } from "next-intl";
import { LIST_GROUP_CLASS } from "../_components/list-group";
import { OnboardingRailSection } from "./onboarding-rail";

/**
 * How starting a goal goes, beside its first screens from `lg`, before there's a plan to show: the
 * goal in the learner's words (where they are), a few questions, then the plan with its dates and
 * the first lesson. Who has no account yet reads that starting needs none, in the home page's words.
 */
export function OnboardingHowItWorks({ hasAccount }: { hasAccount: boolean }) {
  const t = useExtracted();

  const steps = [
    t("Say what you want to achieve"),
    t("Answer a few questions"),
    t("Get a plan with dates, and your first lesson"),
  ];

  return (
    <OnboardingRailSection id="onboarding-how-it-works" title={t("How it works")}>
      <ol className={LIST_GROUP_CLASS}>
        {steps.map((step, index) => (
          <li
            aria-current={index === 0 ? "step" : undefined}
            className="aria-[current=step]:before:bg-muted relative isolate flex min-h-11 items-baseline gap-3 py-2.5 text-sm before:absolute before:-inset-x-2.5 before:inset-y-0.5 before:-z-10 before:rounded-[0.625rem]"
            key={step}
          >
            <span
              aria-hidden="true"
              className="text-faint w-3 shrink-0 font-mono text-xs tabular-nums"
            >
              {index + 1}
            </span>
            <span className="min-w-0 flex-1 text-pretty">{step}</span>
          </li>
        ))}
      </ol>

      {!hasAccount && (
        <p className="text-muted-foreground text-xs text-pretty">
          {t("Start free, no account needed.")}
        </p>
      )}
    </OnboardingRailSection>
  );
}
