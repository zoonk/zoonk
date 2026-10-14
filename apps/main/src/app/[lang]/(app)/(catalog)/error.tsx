"use client";

import { FramePageError } from "@/components/errors/frame-page-error";

/** A failed page keeps the section's bar around the message. */
export default function PageError(props: React.ComponentProps<typeof FramePageError>) {
  return <FramePageError {...props} />;
}
