import { SectionNavSkeleton } from "@/components/learn/section-nav";
import { SettingsNavLinks } from "./settings-links";
import { getSettingsPagesShown } from "./settings-pages-shown";

/** The settings pages as tabs under the section's title, from a tablet up. */
export async function SettingsNavbar() {
  return <SettingsNavLinks {...await getSettingsPagesShown()} />;
}

/** Holds the tabs' place while the session-dependent pages resolve on a cold page load. */
export function SettingsNavbarSkeleton() {
  return <SectionNavSkeleton />;
}
