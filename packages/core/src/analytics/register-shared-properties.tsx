"use client";

import { useEffect } from "react";
import { registerSharedProperties } from "./posthog-browser";
import { type SharedEventProperties } from "./shared-properties";

/**
 * Registers the shared properties as PostHog super properties, so every later
 * browser event carries them. Rendered by server layouts, which know the
 * viewer and locale that client components sending events don't.
 */
export function RegisterSharedEventProperties({
  properties,
}: {
  properties: SharedEventProperties;
}) {
  useEffect(() => {
    void registerSharedProperties(properties);
  }, [properties]);

  return null;
}
