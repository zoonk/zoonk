"use client";

import { LineMarker } from "@zoonk/ui/components/line-marker";
import { Switch } from "@zoonk/ui/components/switch";
import { type BuddyGlasses } from "@zoonk/utils/buddy";
import { LayersIcon, type LucideIcon, SmartphoneIcon, Volume2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useOptimistic } from "react";
import { SectionLabel } from "../_components/section-label";
import {
  SettingCard,
  SettingCardControl,
  SettingCardDescription,
  SettingCardIcon,
  SettingCardLabel,
  SettingCardText,
} from "../_components/setting-card";
import { useOptimisticSave } from "../_utils/use-optimistic-save";
import { type BuddyLook } from "../buddies/buddy-picker";
import { type ExperienceMode } from "../experience-mode";
import { type AppearanceBuddy, BuddySettings } from "./buddy-settings";
import { DailyLimitSetting } from "./daily-limit-setting";
import { ModePicker } from "./mode-picker";

export type { AppearanceBuddy } from "./buddy-settings";

/**
 * What Appearance shows: the learning profile's mode, buddy and sounds, plus the belt and Energy the
 * buddy is drawn with. Visitors without a session can only switch the mode, which their device keeps.
 */
export type AppearanceView = {
  availableGlasses: BuddyGlasses[];
  canPersonalize: boolean;
  dailyLimitMinutes: number | null;
  /** Explanations open their "Go deeper" version first. */
  deeperByDefault: boolean;
  /** On because memory says so, not by the learner's choice. */
  deeperFromMemory: boolean;
  isMinor: boolean;
  look: BuddyLook;
  mode: ExperienceMode;
  buddy: AppearanceBuddy | null;
  soundsEnabled: boolean;
};

/** How Appearance saves. Each resolves to whether it was saved. */
export type AppearanceActions = {
  saveBuddy: (buddy: AppearanceBuddy) => Promise<boolean>;
  setDailyLimit: (minutes: number | null) => Promise<boolean>;
  setDeeperByDefault: (enabled: boolean) => Promise<boolean>;
  setMode: (mode: ExperienceMode) => Promise<boolean>;
  setSoundsEnabled: (enabled: boolean) => Promise<boolean>;
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <SectionLabel className="px-1">{children}</SectionLabel>;
}

function SwitchSetting({
  checked,
  description,
  icon,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  description: string;
  icon: LucideIcon;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  const labelId = useId();
  const descriptionId = useId();

  return (
    <SettingCard>
      <SettingCardIcon icon={icon} />
      <SettingCardText>
        <SettingCardLabel id={labelId}>{label}</SettingCardLabel>
        <SettingCardDescription id={descriptionId}>{description}</SettingCardDescription>
      </SettingCardText>
      <SettingCardControl>
        <Switch
          aria-describedby={descriptionId}
          aria-labelledby={labelId}
          checked={checked}
          onCheckedChange={onCheckedChange}
        />
      </SettingCardControl>
    </SettingCard>
  );
}

function useAppearance({ actions, view }: { actions: AppearanceActions; view: AppearanceView }) {
  const [mode, setOptimisticMode] = useOptimistic(view.mode);
  const [buddy, setOptimisticBuddy] = useOptimistic(view.buddy);
  const [soundsEnabled, setOptimisticSounds] = useOptimistic(view.soundsEnabled);
  const [dailyLimitMinutes, setOptimisticLimit] = useOptimistic(view.dailyLimitMinutes);

  const [deeper, setOptimisticDeeper] = useOptimistic({
    enabled: view.deeperByDefault,
    fromMemory: view.deeperFromMemory,
  });

  const { failed, run } = useOptimisticSave();

  return {
    buddy,
    dailyLimitMinutes,
    deeper,
    failed,
    mode,
    saveBuddy: (next: AppearanceBuddy) =>
      run(
        () => setOptimisticBuddy(next),
        () => actions.saveBuddy(next),
      ),
    setDailyLimit: (next: number | null) =>
      run(
        () => setOptimisticLimit(next),
        () => actions.setDailyLimit(next),
      ),
    setDeeperByDefault: (next: boolean) =>
      run(
        () => setOptimisticDeeper({ enabled: next, fromMemory: false }),
        () => actions.setDeeperByDefault(next),
      ),
    setMode: (next: ExperienceMode) =>
      run(
        () => setOptimisticMode(next),
        () => actions.setMode(next),
      ),
    setSoundsEnabled: (next: boolean) =>
      run(
        () => setOptimisticSounds(next),
        () => actions.setSoundsEnabled(next),
      ),
    soundsEnabled,
  };
}

/**
 * Appearance: Focus or Fun (instant, nothing about learning changes), the Fun buddy, sounds and
 * whether lessons open the deeper version of explanations first.
 * Light, dark and reduced motion follow the device, so there's no theme picker.
 */
export function AppearanceScreen({
  actions,
  view,
}: {
  actions: AppearanceActions;
  view: AppearanceView;
}) {
  const t = useExtracted();
  const appearance = useAppearance({ actions, view });

  return (
    <div className="flex flex-col gap-8" data-slot="appearance-screen">
      <section className="flex flex-col gap-3">
        <SectionTitle>{t("Mode")}</SectionTitle>
        <ModePicker mode={appearance.mode} onChange={appearance.setMode} />
      </section>

      {view.canPersonalize && appearance.mode === "fun" && (
        <section className="flex flex-col gap-3">
          <SectionTitle>{t("Your buddy")}</SectionTitle>
          <BuddySettings
            availableGlasses={view.availableGlasses}
            look={view.look}
            onSave={appearance.saveBuddy}
            buddy={appearance.buddy}
          />
        </section>
      )}

      {view.canPersonalize && (
        <section className="flex flex-col gap-3">
          <SectionTitle>{t("Lessons")}</SectionTitle>
          <SwitchSetting
            checked={appearance.soundsEnabled}
            description={t("When you get it right or finish")}
            icon={Volume2Icon}
            label={t("Sounds")}
            onCheckedChange={appearance.setSoundsEnabled}
          />
          {/* When it's on because a conversation asked for that register, it says so. */}
          <SwitchSetting
            checked={appearance.deeper.enabled}
            description={
              appearance.deeper.fromMemory && appearance.deeper.enabled
                ? t("On because you asked for more technical explanations")
                : t("Explanations open their more technical version first")
            }
            icon={LayersIcon}
            label={t("Go deeper by default")}
            onCheckedChange={appearance.setDeeperByDefault}
          />
        </section>
      )}

      {view.canPersonalize && (
        <section className="flex flex-col gap-3">
          <SectionTitle>{t("Healthy use")}</SectionTitle>
          <DailyLimitSetting
            isMinor={view.isMinor}
            minutes={appearance.dailyLimitMinutes}
            onChange={appearance.setDailyLimit}
          />
        </section>
      )}

      {appearance.failed && (
        <p className="text-destructive text-sm" role="alert">
          {t("That didn't save. Try again.")}
        </p>
      )}

      <p className="text-muted-foreground flex items-start gap-2 text-sm">
        <LineMarker aria-hidden="true">
          <SmartphoneIcon className="size-4" />
        </LineMarker>
        {t(
          "Focus follows your device's light or dark theme, and Fun is always dark. Reduced motion follows your device settings.",
        )}
      </p>
    </div>
  );
}
