import { type ProcessIconName } from "@zoonk/core/library/activities/process-icons";
import { PROCESS_ICONS } from "./process-icons";

/**
 * A step's icon, in the quiet icon color: its shape says what the step shows (sunlight, water, a
 * leaf), and color stays for what means something on every screen. Steps without one show none.
 */
export function ProcessStepIcon({ icon }: { icon: ProcessIconName | undefined }) {
  if (!icon) {
    return null;
  }

  const Icon = PROCESS_ICONS[icon];

  return <Icon aria-hidden="true" className="text-muted-foreground size-[18px] shrink-0" />;
}
