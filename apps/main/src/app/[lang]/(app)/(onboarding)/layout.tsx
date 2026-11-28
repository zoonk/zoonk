import { LearnerClock } from "@/components/learner/learner-clock";
import { LearnerSummarySeed } from "@/components/learner/learner-summary-seed";

export default function OnboardingLayout({ children }: LayoutProps<"/[lang]">) {
  return (
    <>
      <LearnerClock>{children}</LearnerClock>
      <LearnerSummarySeed />
    </>
  );
}
