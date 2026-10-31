"use client";

import { trackEvent } from "@zoonk/core/analytics/client";
import { useEffect } from "react";

type PublicView =
  | { contentId: string; page: "chapter" | "course" | "lesson" }
  | { contentId?: undefined; page: "home" };

/** From the browser, so the pages stay server-rendered and cacheable. */
export function PublicViewTracker({ contentId, page }: PublicView) {
  useEffect(() => {
    if (page === "home") {
      trackEvent({ name: "Home Viewed" });
      return;
    }

    trackEvent({ name: "Public Page Viewed", properties: { content_id: contentId, page } });
  }, [contentId, page]);

  return null;
}
