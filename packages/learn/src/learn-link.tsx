"use client";

import { type LearnLinkComponentProps, useLearnLinkComponent } from "./learn-context";

/**
 * Links through the host app's navigation component, so destinations keep the
 * host's routing and prefetching. Destinations prefetch unless told not to.
 */
export function LearnLink({ prefetch = true, ...props }: LearnLinkComponentProps) {
  const LinkComponent = useLearnLinkComponent();

  // oxlint-disable-next-line react/static-components -- The host supplies a stable module-level Link through context; this hook does not create a component.
  return <LinkComponent {...props} prefetch={prefetch} />;
}
