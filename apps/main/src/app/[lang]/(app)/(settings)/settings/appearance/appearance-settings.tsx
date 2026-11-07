"use client";

import { usePathname } from "@/i18n/navigation";
import { switchLanguage } from "@/i18n/switch-language";
import { notifyUsageDataChoice } from "@/lib/usage-data/usage-data-choice";
import {
  type AppearanceActions,
  AppearanceScreen,
  type AppearanceView,
} from "@zoonk/learn/appearance";
import {
  saveBuddyAction,
  setDailyLimitAction,
  setShareUsageDataAction,
  setSoundsEnabledAction,
} from "./actions";

const APPEARANCE_ACTIONS: AppearanceActions = {
  saveBuddy: saveBuddyAction,
  setDailyLimit: setDailyLimitAction,
  setShareUsageData: async (share) => {
    const saved = await setShareUsageDataAction(share);
    notifyUsageDataChoice();
    return saved;
  },
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
