import { type ProcessIconName } from "@zoonk/core/library/activities/process-icons";
import { PROCESS_ICONS } from "./process-icons";

export function ProcessStepIcon({ icon }: { icon: ProcessIconName | undefined }) {
  if (!icon) {
    return null;
  }

  const Icon = PROCESS_ICONS[icon];

  return <Icon aria-hidden="true" className="text-muted-foreground size-[18px] shrink-0" />;
}
