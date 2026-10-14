import { LearnerSummarySeed } from "@/components/learner/learner-summary-seed";
import { type Metadata } from "next";

/** The tabs show one learner's own plan and progress: nothing here is for search. */
export const metadata: Metadata = { robots: { follow: false, index: false } };

export default function LearnLayout({ children }: LayoutProps<"/[lang]">) {
  return (
    <>
      {children}
      <LearnerSummarySeed />
    </>
  );
}
