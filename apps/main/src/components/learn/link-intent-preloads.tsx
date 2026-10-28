"use client";

import { preloadScoreChart } from "@/app/[lang]/(app)/(stats)/score/score-chart-code";
import { OVERVIEW_CHART_MEDIA } from "@/app/[lang]/(app)/(stats)/stats/overview-chart-media";
import { preloadLessonPlayer } from "@/app/[lang]/explain/[goalId]/lesson-player-code";
import { SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { useEffect } from "react";

const LOCALE_PREFIX = new RegExp(`^/(?:${SUPPORTED_LOCALES.join("|")})(?=/|$)`, "u");

const INTENT_EVENTS = ["focusin", "pointerdown", "pointerover"] as const;

function preloadFor(pathname: string): (() => void) | null {
  if (pathname === "/score") {
    return preloadScoreChart;
  }

  if (pathname === "/stats") {
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
