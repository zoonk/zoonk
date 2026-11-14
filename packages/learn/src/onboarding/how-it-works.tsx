"use client";

import { useExtracted } from "next-intl";
import { LIST_GROUP_CLASS } from "../_components/list-group";
import { OnboardingRailSection } from "./onboarding-rail";

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
          <li className="flex min-h-11 items-baseline gap-3 py-2.5 text-sm" key={step}>
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
