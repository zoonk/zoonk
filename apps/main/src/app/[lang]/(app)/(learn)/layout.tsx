import { LearnerSummarySeed } from "@/components/learner/learner-summary-seed";
import { type Metadata } from "next";

export const metadata: Metadata = { robots: { follow: false, index: false } };

export default function LearnLayout({ children }: LayoutProps<"/[lang]">) {
  return (
    <>
      {children}
      <LearnerSummarySeed />
    </>
  );
}
