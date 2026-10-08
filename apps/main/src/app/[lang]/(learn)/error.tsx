"use client";

import { FramePageError } from "@/components/errors/frame-page-error";
import { JourneyPageBar } from "@/components/learn/journey-page-bar";
import { useIsTabRoot } from "./_components/learn-tab-navigation";

/**
 * A failed page keeps the app's bars around the message: a tab keeps the app bar, and a page
 * opened from the Journey keeps its way back.
 */
export default function PageError(props: React.ComponentProps<typeof FramePageError>) {
  const isTabRoot = useIsTabRoot();

  return (
    <>
      {!isTabRoot && <JourneyPageBar />}
      <FramePageError {...props} />
    </>
  );
}
