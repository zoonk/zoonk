"use client";

import { FramePageError } from "@/components/errors/frame-page-error";

export default function PageError(props: React.ComponentProps<typeof FramePageError>) {
  return <FramePageError {...props} />;
}
