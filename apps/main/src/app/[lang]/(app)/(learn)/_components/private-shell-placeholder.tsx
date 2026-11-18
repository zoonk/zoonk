"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import { type ReactNode, Suspense } from "react";

type PlaceholderProps = { children: ReactNode };

function PrivatePlaceholder({ children }: PlaceholderProps) {
  const section = useSelectedLayoutSegment();
  return section === "(catalog)" ? null : children;
}

/** The public catalog uses the same frame, but has no learner content to stream. */
export function PrivateShellPlaceholder({ children }: PlaceholderProps) {
  return (
    <Suspense>
      <PrivatePlaceholder>{children}</PrivatePlaceholder>
    </Suspense>
  );
}
