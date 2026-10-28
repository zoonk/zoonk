"use client";

import { FramePageError } from "@/components/errors/frame-page-error";
import { FallbackPageBar } from "./_components/fallback-page-bar";

export default function PageError(props: React.ComponentProps<typeof FramePageError>) {
  return (
    <>
      <FallbackPageBar />
      <FramePageError {...props} />
    </>
  );
}
