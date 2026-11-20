"use client";

import { usePathname } from "@/i18n/navigation";
import { switchLanguage } from "@/i18n/switch-language";
import {
  type AppearanceActions,
  AppearanceScreen,
  type AppearanceView,
} from "@zoonk/learn/appearance";
import { saveBuddyAction, setHomeCountryAction, setSoundsEnabledAction } from "./actions";

const APPEARANCE_ACTIONS: AppearanceActions = {
  saveBuddy: saveBuddyAction,
  setHomeCountry: setHomeCountryAction,
  setSoundsEnabled: setSoundsEnabledAction,
};

export function AppearanceSettings({ view }: { view: AppearanceView }) {
  const pathname = usePathname();

  return (
    <AppearanceScreen
      actions={APPEARANCE_ACTIONS}
      onLanguageChange={(locale) => void switchLanguage({ href: pathname, locale })}
      view={view}
    />
  );
}
