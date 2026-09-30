import { ClientMessagesProvider } from "@/i18n/client-messages-provider";
import { type Metadata } from "next";
import { Suspense } from "react";
import { LearnFrame } from "./_components/learn-frame";
import { LearnFrameSkeleton } from "./_components/learn-frame-skeleton";

/** The tabs show one learner's own plan and progress: nothing here is for search. */
export const metadata: Metadata = { robots: { follow: false, index: false } };

export default function LearnLayout({ children }: LayoutProps<"/[lang]">) {
  return (
    <ClientMessagesProvider scope="learn">
      <Suspense fallback={<LearnFrameSkeleton />}>
        <LearnFrame>{children}</LearnFrame>
      </Suspense>
    </ClientMessagesProvider>
  );
}
