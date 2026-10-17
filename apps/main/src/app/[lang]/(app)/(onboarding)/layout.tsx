import { LearnerSummarySeed } from "@/components/learner/learner-summary-seed";

/** Onboarding's screens are the learner's own: the frame shows them from their summary. */
export default function OnboardingLayout({ children }: LayoutProps<"/[lang]">) {
  return (
    <>
      {children}
      <LearnerSummarySeed />
    </>
  );
}
