"use client";

import { getPathname, usePathname } from "@/i18n/navigation";
import { rememberLocale } from "@/i18n/remember-locale";
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
   * Saves the choice, then opens the page in it with a document navigation, because changing the
   * root language through the client router can lose its in-flight response when the proxy
   * canonicalizes English. The forced prefix lets the proxy send English to its unprefixed URL.
   */
  function changeLanguage(locale: SupportedLocale) {
    rememberLocale(locale);
    globalThis.location.replace(getPathname({ forcePrefix: true, href: pathname, locale }));
  }

  return (
    <AppearanceScreen actions={APPEARANCE_ACTIONS} onLanguageChange={changeLanguage} view={view} />
  );
}
