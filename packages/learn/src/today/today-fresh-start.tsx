"use client";

import { LineMarker } from "@zoonk/ui/components/line-marker";
import { SunriseIcon } from "lucide-react";
import { useFreshStartText } from "./use-today-copy";

export function TodayFreshStart() {
  const text = useFreshStartText();

  if (!text) {
    return null;
  }

  return (
    <p className="bg-muted/60 in-data-[mode=fun]:fun-glass flex items-start gap-2 rounded-2xl px-4 py-3 text-sm">
      <LineMarker>
        <SunriseIcon aria-hidden="true" className="text-warning size-4" />
      </LineMarker>
      {text}
    </p>
  );
}
