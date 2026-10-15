import { SectionNavSkeleton } from "@/components/learn/section-nav";
import { LearnerWitness } from "@/components/learner/learner-witness";
import { SettingsNavLinks } from "./settings-links";
import { getSettingsPagesShown } from "./settings-pages-shown";

/** The settings pages as tabs under the section's title, from a tablet up. */
export async function SettingsNavbar() {
  return (
    <>
      <LearnerWitness />
      <SettingsNavLinks {...await getSettingsPagesShown()} />
    </>
  );
}

/** Holds the tabs' place while the session-dependent pages resolve on a cold page load. */
export function SettingsNavbarSkeleton() {
  return <SectionNavSkeleton />;
}
