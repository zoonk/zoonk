"use client";

import { useEffect } from "react";
import { registerSharedProperties } from "./posthog-browser";
import { type SharedEventProperties } from "./shared-properties";

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
