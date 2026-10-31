"use client";

import { type ResolvedBuddy } from "@zoonk/core/profile/default-buddy";
import { type BuddyGlasses } from "@zoonk/utils/buddy";
import { type SupportedLocale } from "@zoonk/utils/locale";
import { useExtracted } from "next-intl";
import { useOptimistic } from "react";
import { ListGroup } from "../_components/list-group";
import { PageSection, PageSectionHeader, PageSectionTitle } from "../_components/page";
import { ChangeSaveError } from "../_components/save-error";
import { SwitchSettingRow } from "../_components/setting-rows";
import { useOptimisticSave } from "../_utils/use-optimistic-save";
import { type BuddyLook } from "../buddies/buddy-picker";
import { type AppearanceBuddy, BuddySettings } from "./buddy-settings";
import { DailyLimitSetting } from "./daily-limit-setting";
import { LanguageSetting } from "./language-setting";

export type { AppearanceBuddy } from "./buddy-settings";

export type AppearanceView = {
  availableGlasses: BuddyGlasses[];
  canPersonalize: boolean;
  dailyLimitMinutes: number | null;
  look: BuddyLook;
  buddy: ResolvedBuddy;
  shareUsageData: boolean;
  soundsEnabled: boolean;
  usageDataLockedOff: boolean;
};

/** How Preferences saves. Each resolves to whether it was saved. */
export type AppearanceActions = {
  saveBuddy: (buddy: AppearanceBuddy) => Promise<boolean>;
  setDailyLimit: (minutes: number | null) => Promise<boolean>;
  setShareUsageData: (share: boolean) => Promise<boolean>;
  setSoundsEnabled: (enabled: boolean) => Promise<boolean>;
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <PageSectionHeader>
      <PageSectionTitle>{children}</PageSectionTitle>
    </PageSectionHeader>
  );
}

function useAppearance({ actions, view }: { actions: AppearanceActions; view: AppearanceView }) {
  const [buddy, setOptimisticBuddy] = useOptimistic(view.buddy);
  const [soundsEnabled, setOptimisticSounds] = useOptimistic(view.soundsEnabled);
  const [dailyLimitMinutes, setOptimisticLimit] = useOptimistic(view.dailyLimitMinutes);
  const [shareUsageData, setOptimisticShare] = useOptimistic(view.shareUsageData);

  const { failed, run } = useOptimisticSave();

  return {
    buddy,
    dailyLimitMinutes,
    failed,
    saveBuddy: (next: AppearanceBuddy) =>
      run(
        () => setOptimisticBuddy({ ...next, picked: true }),
        () => actions.saveBuddy(next),
      ),
    setDailyLimit: (next: number | null) =>
      run(
        () => setOptimisticLimit(next),
        () => actions.setDailyLimit(next),
      ),
    setShareUsageData: (next: boolean) =>
      run(
        () => setOptimisticShare(next),
        () => actions.setShareUsageData(next),
      ),
    setSoundsEnabled: (next: boolean) =>
      run(
        () => setOptimisticSounds(next),
        () => actions.setSoundsEnabled(next),
      ),
    shareUsageData,
    soundsEnabled,
  };
}

export function AppearanceScreen({
  actions,
  onLanguageChange,
  view,
}: {
  actions: AppearanceActions;
  onLanguageChange: (locale: SupportedLocale) => void;
  view: AppearanceView;
}) {
  const t = useExtracted();
  const appearance = useAppearance({ actions, view });

  return (
    <div className="flex flex-col gap-7" data-slot="appearance-screen">
      {view.canPersonalize && (
        <PageSection>
          <SectionTitle>{t("Your buddy")}</SectionTitle>
          <BuddySettings
            availableGlasses={view.availableGlasses}
            look={view.look}
            onSave={appearance.saveBuddy}
            buddy={appearance.buddy}
          />
        </PageSection>
      )}

      {view.canPersonalize && (
        <PageSection>
          <SectionTitle>{t("Lessons")}</SectionTitle>
          <ListGroup>
            <SwitchSettingRow
              checked={appearance.soundsEnabled}
              description={t("When you get it right or finish")}
              label={t("Sounds")}
              onCheckedChange={appearance.setSoundsEnabled}
            />
            <DailyLimitSetting
              minutes={appearance.dailyLimitMinutes}
              onChange={appearance.setDailyLimit}
            />
          </ListGroup>
        </PageSection>
      )}

      <PageSection>
        <SectionTitle>{t("Language")}</SectionTitle>
        <ListGroup>
          <LanguageSetting onChange={onLanguageChange} />
        </ListGroup>
      </PageSection>

      <PageSection>
        <SectionTitle>{t("Privacy")}</SectionTitle>
        <ListGroup>
          <SwitchSettingRow
            checked={appearance.shareUsageData}
            description={
              view.usageDataLockedOff
                ? t("Off for learners under 18 in your country")
                : t("Shows us how you use Zoonk, so we can improve it")
            }
            disabled={view.usageDataLockedOff}
            label={t("Share usage data")}
            onCheckedChange={appearance.setShareUsageData}
          />
        </ListGroup>
      </PageSection>

      {appearance.failed && <ChangeSaveError />}
    </div>
  );
}
