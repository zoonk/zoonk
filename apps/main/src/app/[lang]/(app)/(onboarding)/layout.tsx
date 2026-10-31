import { LearnerSummarySeed } from "@/components/learner/learner-summary-seed";

export default function OnboardingLayout({ children }: LayoutProps<"/[lang]">) {
  return (
    <>
      {children}
      <LearnerSummarySeed />
    </>
  );
}
