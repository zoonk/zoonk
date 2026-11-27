"use client";

import { useExtracted } from "next-intl";
import { ListGroup } from "../_components/list-group";
import { FreeStartNote } from "./free-start-note";
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
      <ListGroup as="ol">
        {steps.map((step, index) => (
          <li className="flex min-h-11 items-start gap-3 py-2.5 text-sm" key={step}>
            <span
              aria-hidden="true"
              className="text-faint flex h-5 w-3 shrink-0 items-center font-mono text-xs tabular-nums"
              data-slot="list-row-lead"
            >
              {index + 1}
            </span>
            <span className="min-w-0 flex-1" data-slot="list-row-title">
              {step}
            </span>
          </li>
        ))}
      </ListGroup>

      {!hasAccount && <FreeStartNote />}
    </OnboardingRailSection>
  );
}
