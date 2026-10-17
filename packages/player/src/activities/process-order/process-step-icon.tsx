import { type ProcessIconName } from "@zoonk/core/library/activities/process-icons";
import { cn } from "@zoonk/ui/lib/utils";
import { ICON_TONE_STROKES, PROCESS_ICON_TONES } from "./process-icon-tones";
import { PROCESS_ICONS } from "./process-icons";

/** A step's icon on a small tile, colored by what it shows. Steps without one keep the space. */
export function ProcessStepIcon({ icon }: { icon: ProcessIconName | undefined }) {
  if (!icon) {
    return null;
  }

  const Icon = PROCESS_ICONS[icon];
  const tone = PROCESS_ICON_TONES[icon] ?? "gray";

  return (
    <span
      aria-hidden="true"
      className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-xl"
    >
      <Icon className={cn("size-[18px]", ICON_TONE_STROKES[tone])} />
    </span>
  );
}
