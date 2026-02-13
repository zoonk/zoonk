"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useEffect, useState } from "react";

const STORAGE_KEY = "zoonk:coaching:static-nav";
const HOLD_DURATION = 1500;
const FADE_OUT_DURATION = 500;

function hasSeenCoaching(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function markCoachingSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "true");
  } catch {
    // localStorage unavailable — ignore
  }
}

export function CoachingOverlay() {
  const t = useExtracted();
  const [phase, setPhase] = useState<"hidden" | "visible" | "fading">("hidden");

  useEffect(() => {
    if (hasSeenCoaching()) {
      return;
    }

    markCoachingSeen();
    setPhase("visible");

    const holdTimer = setTimeout(() => {
      setPhase("fading");
    }, HOLD_DURATION);

    const hideTimer = setTimeout(() => {
      setPhase("hidden");
    }, HOLD_DURATION + FADE_OUT_DURATION);

    return () => {
      clearTimeout(holdTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (phase === "hidden") {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className={cn(
        "absolute inset-0 z-30 flex items-center justify-center bg-black/40 transition-opacity",
        "motion-reduce:transition-none",
        phase === "visible" && "animate-in fade-in duration-300 motion-reduce:animate-none",
        phase === "fading" && "opacity-0 duration-500",
      )}
      role="status"
    >
      <p className="text-center text-lg font-medium text-white">
        {t("Tap, swipe, or use arrow keys to navigate")}
      </p>
    </div>
  );
}
