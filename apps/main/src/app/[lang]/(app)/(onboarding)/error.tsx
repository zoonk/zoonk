"use client";

import { FramePageError } from "@/components/errors/frame-page-error";
import { LearnPageBar } from "@zoonk/learn/bar";

/** A failed onboarding page keeps the app's frame and, under `lg`, the bar's way back. */
export default function OnboardingError(props: React.ComponentProps<typeof FramePageError>) {
  return (
    <>
      <LearnPageBar back={{ href: "/today" }} root />
      <FramePageError {...props} />
    </>
  );
}
