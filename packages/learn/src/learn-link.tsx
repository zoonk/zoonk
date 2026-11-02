"use client";

import { type LearnLinkComponentProps, useLearnLinkComponent } from "./learn-context";

export function LearnLink({ prefetch = true, ...props }: LearnLinkComponentProps) {
  const LinkComponent = useLearnLinkComponent();

  // oxlint-disable-next-line react/static-components -- The host supplies a stable module-level Link through context; this hook does not create a component.
  return <LinkComponent {...props} prefetch={prefetch} />;
}
