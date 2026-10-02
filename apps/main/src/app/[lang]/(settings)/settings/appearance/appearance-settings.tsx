"use client";

import { trackEvent } from "@zoonk/core/analytics/client";
import {
  type AppearanceActions,
  AppearanceScreen,
  type AppearanceView,
} from "@zoonk/learn/appearance";
import {
  saveBuddyAction,
  setDailyLimitAction,
  setDeeperByDefaultAction,
  setModeAction,
  setSoundsEnabledAction,
} from "./actions";

/** Appearance with main's actions, counting mode switches to compare Focus and Fun. */
export function AppearanceSettings({ view }: { view: AppearanceView }) {
  const actions: AppearanceActions = {
    saveBuddy: saveBuddyAction,
    setDailyLimit: setDailyLimitAction,
    setDeeperByDefault: setDeeperByDefaultAction,
    setMode: async (mode) => {
      const saved = await setModeAction(mode);

      if (saved) {
        trackEvent({ name: "Mode Switched", properties: { from_mode: view.mode, to_mode: mode } });
      }

      return saved;
    },
    setSoundsEnabled: setSoundsEnabledAction,
  };

  return <AppearanceScreen actions={actions} view={view} />;
}
