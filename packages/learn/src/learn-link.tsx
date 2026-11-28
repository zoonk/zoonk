"use client";

import { useState } from "react";
import { type LearnLinkComponentProps, useLearnLinkComponent } from "./learn-context";

export type LearnPrefetch = LearnLinkComponentProps["prefetch"] | "intent";

export function LearnLink({
  prefetch = true,
  ...props
}: Omit<LearnLinkComponentProps, "prefetch"> & { prefetch?: LearnPrefetch }) {
  const LinkComponent = useLearnLinkComponent();
  const [intentHref, setIntentHref] = useState<string>();
  const intentPrefetch = intentHref === props.href ? true : "auto";

  function withIntent<Event>(handler?: (event: Event) => void) {
    if (prefetch !== "intent") {
      return handler;
    }

    return (event: Event) => {
      setIntentHref(props.href);
      handler?.(event);
    };
  }

  return (
    // oxlint-disable-next-line react/static-components -- The host supplies a stable module-level Link through context; this hook does not create a component.
    <LinkComponent
      {...props}
      onFocus={withIntent(props.onFocus)}
      onMouseEnter={withIntent(props.onMouseEnter)}
      onTouchStart={withIntent(props.onTouchStart)}
      prefetch={prefetch === "intent" ? intentPrefetch : prefetch}
    />
  );
}
