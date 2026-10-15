"use client";

import { preloadScoreChart } from "@/app/[lang]/(app)/(stats)/score/score-chart-code";
import { OVERVIEW_CHART_MEDIA } from "@/app/[lang]/(app)/(stats)/stats/overview-chart-media";
import { preloadLessonPlayer } from "@/app/[lang]/explain/[goalId]/lesson-player-code";
import { SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { useEffect } from "react";

/** A link's language prefix (`/pt` in `/pt/stats`), absent for the default language. */
const LOCALE_PREFIX = new RegExp(`^/(?:${SUPPORTED_LOCALES.join("|")})(?=/|$)`, "u");

/** Reaching for a link: the pointer over it, focus on it, a press (a tap starts with one). */
const INTENT_EVENTS = ["focusin", "pointerdown", "pointerover"] as const;

/** The code a page loads on its own (out of its first load), by the page's path. */
function preloadFor(pathname: string): (() => void) | null {
  if (pathname === "/score") {
    return preloadScoreChart;
  }

  if (pathname === "/stats") {
    // The overview draws Score's chart only from a tablet up.
    return globalThis.matchMedia(OVERVIEW_CHART_MEDIA).matches ? preloadScoreChart : null;
  }

  return pathname.startsWith("/explain/") ? preloadLessonPlayer : null;
}

function preloadLinkTarget(event: Event) {
  const link = event.target instanceof Element ? event.target.closest("a[href]") : null;

  if (link instanceof HTMLAnchorElement && link.origin === globalThis.location.origin) {
    preloadFor(link.pathname.replace(LOCALE_PREFIX, "") || "/")?.();
  }
}

/**
 * Reaching for a link starts loading the code its page draws on its own, so the page opens with
 * it: Score's chart for Score and (from a tablet up) the overview, the lesson player for an
 * explanation. One listener for every link in the app (the sidebar, the bars, the goal switcher,
 * search, the stats pages' tiles and tabs) instead of a handler on each.
 */
export function LinkIntentPreloads() {
  useEffect(() => {
    for (const type of INTENT_EVENTS) {
      document.addEventListener(type, preloadLinkTarget, { capture: true, passive: true });
    }

    return () => {
      for (const type of INTENT_EVENTS) {
        document.removeEventListener(type, preloadLinkTarget, { capture: true });
      }
    };
  }, []);

  return null;
}
