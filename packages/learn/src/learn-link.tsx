"use client";

import { type LearnLinkComponentProps, useLearnLinkComponent } from "./learn-context";

export type LearnPrefetch = LearnLinkComponentProps["prefetch"] | "intent";

/** `intent` prefetches the page's shell, and the whole page once it's hovered or touched. */
export function LearnLink({
  prefetch = true,
  ...props
}: Omit<LearnLinkComponentProps, "prefetch" | "unstable_dynamicOnHover"> & {
  prefetch?: LearnPrefetch;
}) {
  const LinkComponent = useLearnLinkComponent();
  const intent = prefetch === "intent";

  return (
    // oxlint-disable-next-line react/static-components -- The host supplies a stable module-level Link through context; this hook does not create a component.
    <LinkComponent
      {...props}
      prefetch={intent ? "auto" : prefetch}
      unstable_dynamicOnHover={intent || undefined}
    />
  );
}
