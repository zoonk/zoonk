"use client";

import { FramePageError } from "@/components/errors/frame-page-error";
import { FallbackPageBar } from "./_components/fallback-page-bar";

/** A failed page keeps the app's bars around the message (see `FallbackPageBar`). */
export default function PageError(props: React.ComponentProps<typeof FramePageError>) {
  return (
    <>
      <FallbackPageBar />
      <FramePageError {...props} />
    </>
  );
}
