import { SectionNavSkeleton } from "@/components/learn/section-nav";
import { SettingsNavLinks } from "./settings-links";
import { getSettingsPagesShown } from "./settings-pages-shown";

export async function SettingsNavbar() {
  return <SettingsNavLinks {...await getSettingsPagesShown()} />;
}

export function SettingsNavbarSkeleton() {
  return <SectionNavSkeleton />;
}
