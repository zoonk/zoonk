"use client";

import { type ReactNode, createContext, use, useState } from "react";

const OnboardingAnnounceContext = createContext<((message: string) => void) | null>(null);

/**
 * One polite status for the flow's screens, so what a screen says to screen readers (the answer a
 * one-answer question moved on with) is still heard once the next screen replaces it.
 */
export function OnboardingAnnouncer({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");

  return (
    <OnboardingAnnounceContext value={setMessage}>
      {children}
      <p className="sr-only" role="status">
        {message}
      </p>
    </OnboardingAnnounceContext>
  );
}

/** Says a message through the flow's status; null outside a flow that has one. */
export function useOnboardingAnnounce(): ((message: string) => void) | null {
  return use(OnboardingAnnounceContext);
}
