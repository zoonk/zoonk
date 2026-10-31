"use client";

import { type ReactNode, createContext, use, useState } from "react";

const OnboardingAnnounceContext = createContext<((message: string) => void) | null>(null);

/**
 * One polite status above the screens, so what a screen says is still heard once the next one
 * replaces it.
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

export function useOnboardingAnnounce(): ((message: string) => void) | null {
  return use(OnboardingAnnounceContext);
}
