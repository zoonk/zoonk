"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import { type ReactNode, Suspense } from "react";

type PlaceholderProps = { children: ReactNode; fallback?: ReactNode };

function PrivatePlaceholder({ children, fallback }: PlaceholderProps) {
  const section = useSelectedLayoutSegment();
  return section === "(learn)" || section === "(onboarding)" ? children : fallback;
}

/** The public catalog uses the same frame, but has no learner content to stream. */
export function PrivateShellPlaceholder({ children, fallback }: PlaceholderProps) {
  return (
    <Suspense fallback={fallback}>
      <PrivatePlaceholder fallback={fallback}>{children}</PrivatePlaceholder>
    </Suspense>
  );
}
