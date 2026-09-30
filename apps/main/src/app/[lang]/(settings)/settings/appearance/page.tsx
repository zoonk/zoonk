import { getExperienceMode } from "@/lib/learn/experience-mode";
import { getLearningProfile } from "@zoonk/core/profile/get";
import { getBeltLevel } from "@zoonk/core/progress/get-belt-level";
import { getEnergyLevel } from "@zoonk/core/progress/get-energy-level";
import {
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
} from "@zoonk/ui/components/container";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { SettingsPage, SettingsPageTitle } from "../../_components/settings-page";
import { AppearanceSettings } from "./appearance-settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return {
    description: t(
      "Choose Focus or Fun, your buddy, sounds, how deep lessons go and a daily time limit.",
    ),
    robots: { follow: false, index: false },
    title: t("Appearance"),
  };
}

/** The learning profile is Appearance's view; the belt and Energy only draw the buddy. */
async function AppearanceContent() {
  const [profile, mode, belt, energy] = await Promise.all([
    getLearningProfile(),
    getExperienceMode(),
    getBeltLevel(),
    getEnergyLevel(),
  ]);

  return (
    <AppearanceSettings
      view={{
        availableGlasses: profile?.availableGlasses ?? ["round"],
        buddy: profile?.buddy ?? null,
        canPersonalize: profile !== null,
        dailyLimitMinutes: profile?.dailyLimitMinutes ?? null,
        deeperByDefault: profile?.deeperByDefault ?? false,
        deeperFromMemory: profile?.deeperFromMemory ?? false,
        isMinor: profile?.ageGroup === "teen",
        look: { beltColor: belt?.color ?? "white", energy: energy?.currentEnergy ?? 0 },
        mode,
        soundsEnabled: profile?.soundsEnabled ?? true,
      }}
    />
  );
}

function AppearanceSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
      <Skeleton className="h-20 rounded-2xl" />
    </div>
  );
}

export default async function AppearancePage() {
  const t = await getExtracted();

  return (
    <SettingsPage>
      <ContainerHeader>
        <ContainerHeaderGroup>
          <SettingsPageTitle>{t("Appearance")}</SettingsPageTitle>
          <ContainerDescription>
            {t("The same plan and lessons in the look you like.")}
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <Suspense fallback={<AppearanceSkeleton />}>
          <AppearanceContent />
        </Suspense>
      </ContainerBody>
    </SettingsPage>
  );
}
