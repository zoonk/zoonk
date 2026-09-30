"use client";

import {
  EXPERIENCE_MODE_COOKIE_PATTERN,
  readExperienceModeCookie,
  writeExperienceModeCookie,
} from "@zoonk/core/profile/mode-cookie";
import { createContext, use, useEffect } from "react";
import { type ExperienceMode } from "./experience-mode";

const ModeContext = createContext<ExperienceMode | null>(null);

/**
 * Dialogs, sheets and toasts render in portals outside this subtree, so the
 * document root mirrors the mode for them. The attribute is removed when the
 * learning experience unmounts, which returns other pages to Focus tokens.
 */
function useDocumentMode(mode: ExperienceMode) {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.mode = mode;

    return () => {
      delete root.dataset.mode;
    };
  }, [mode]);
}

/**
 * Leaves the rendered mode on the device, so the skeleton the next hard load paints before the
 * learner's data arrives (`DeviceModeRoot`) takes the same look. Learners who picked their mode on
 * another device, or before the cookie existed, get it on their next visit.
 */
function useDeviceMode(mode: ExperienceMode) {
  useEffect(() => {
    if (readExperienceModeCookie(document.cookie) !== mode) {
      writeExperienceModeCookie(mode);
    }
  }, [mode]);
}

/**
 * Applies the learner's mode to everything inside it through `data-mode`, which
 * switches the Fun tokens in `@zoonk/ui/fun.css`. Fun is dark only; Focus follows
 * the device's light or dark theme. Reduced motion always follows the device.
 */
export function ModeProvider({
  children,
  experienceMode,
}: {
  children: React.ReactNode;
  experienceMode: ExperienceMode;
}) {
  useDocumentMode(experienceMode);
  useDeviceMode(experienceMode);

  return (
    <ModeContext value={experienceMode}>
      <div className="contents" data-mode={experienceMode} data-slot="mode-root">
        {children}
      </div>
    </ModeContext>
  );
}

/**
 * Runs as the parser reaches it, before the skeleton below paints: the root takes the mode the
 * device keeps, so a Fun learner's skeleton is deep space from the first frame instead of Focus's
 * white on a light device. The app sends no Content-Security-Policy today; one would need a nonce
 * on this script.
 */
const DEVICE_MODE_SCRIPT = `try{var m=document.cookie.match(${String(EXPERIENCE_MODE_COOKIE_PATTERN)});if(m)document.currentScript.parentElement.dataset.mode=m[1]}catch(e){}`;

/**
 * The root of a skeleton that paints before the learner's mode is known, in the mode this device
 * keeps (`useDeviceMode`). A hard load sets it with the inline script; a client render reads it
 * directly, and its script is plain text so it neither runs nor makes React warn. Skeletons are
 * replaced by the page, never hydrated into it, and `suppressHydrationWarning` keeps what the
 * script set if one ever is.
 */
export function DeviceModeRoot({ children }: { children: React.ReactNode }) {
  const isServer = typeof document === "undefined";
  const mode = isServer ? undefined : (readExperienceModeCookie(document.cookie) ?? undefined);

  return (
    <div className="contents" data-mode={mode} data-slot="mode-root" suppressHydrationWarning>
      <script
        // oxlint-disable-next-line react/no-danger -- A fixed script of ours, with no request data in it.
        dangerouslySetInnerHTML={{ __html: DEVICE_MODE_SCRIPT }}
        suppressHydrationWarning
        type={isServer ? "text/javascript" : "text/plain"}
      />
      {/* Fun's sky behind the skeleton, as the frame paints it, so it doesn't change when the frame arrives. */}
      <div
        aria-hidden
        className="in-data-[mode=fun]:fun-space fixed inset-0 -z-10 hidden in-data-[mode=fun]:block"
      />
      {children}
    </div>
  );
}

/** The nearest ModeProvider's mode, or null outside one (such as onboarding before its mode step). */
export function useOptionalExperienceMode(): ExperienceMode | null {
  return use(ModeContext);
}

export function useExperienceMode(): ExperienceMode {
  const mode = useOptionalExperienceMode();

  if (!mode) {
    throw new Error("useExperienceMode must be used within a ModeProvider");
  }

  return mode;
}
