import { GoalEntry } from "@repo/packages/learn/src/onboarding/entry/goal-entry.tsx";
import { OnboardingShell, S, noop, type ViewProps } from "./common";

export function GoalEntryView({ lang, q }: ViewProps) {
  const text = S(lang).career.goalText;
  const typed = Number(q.get("typed") ?? text.length);
  const value = text.slice(0, Math.max(0, Math.min(text.length, typed)));

  return (
    <OnboardingShell backHref="/">
      <GoalEntry
        key={value}
        defaultGoal={value}
        error={null}
        onAttach={noop}
        onSubmit={noop}
        signUpHref="/login"
      />
    </OnboardingShell>
  );
}
