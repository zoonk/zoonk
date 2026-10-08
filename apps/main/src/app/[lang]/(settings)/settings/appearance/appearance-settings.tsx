"use client";

import { getPathname, usePathname } from "@/i18n/navigation";
import {
  type AppearanceActions,
  AppearanceScreen,
  type AppearanceView,
} from "@zoonk/learn/appearance";
import { type SupportedLocale } from "@zoonk/utils/locale";
import { saveBuddyAction, setDailyLimitAction, setSoundsEnabledAction } from "./actions";

const APPEARANCE_ACTIONS: AppearanceActions = {
  saveBuddy: saveBuddyAction,
  setDailyLimit: setDailyLimitAction,
  setSoundsEnabled: setSoundsEnabledAction,
};

/** Appearance with main's Server Actions and its language switch. */
export function AppearanceSettings({ view }: { view: AppearanceView }) {
  const pathname = usePathname();

  /**
   * Use a document navigation because changing the root language through the client router can
   * lose its in-flight response when the proxy canonicalizes English. The forced prefix lets the
   * proxy persist the explicit choice before redirecting English to its unprefixed URL.
   */
  function changeLanguage(locale: SupportedLocale) {
    globalThis.location.replace(getPathname({ forcePrefix: true, href: pathname, locale }));
  }

  return (
    <AppearanceScreen actions={APPEARANCE_ACTIONS} onLanguageChange={changeLanguage} view={view} />
  );
}
