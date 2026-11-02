"use client";

import { FramePageError } from "@/components/errors/frame-page-error";
import { LearnPageBar } from "@zoonk/learn/bar";

export default function OnboardingError(props: React.ComponentProps<typeof FramePageError>) {
  return (
    <>
      <LearnPageBar back={{ href: "/today" }} root />
      <FramePageError {...props} />
    </>
  );
}
