import { cn } from "@zoonk/ui/lib/utils";
import { FeatherIcon, LayersIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";

/** Each mode draws the chips the way its lesson screen does. */
const CHIP_CLASS = {
  focus: "bg-secondary min-h-8 gap-1.5 px-2.5 text-[13px] font-medium [&_svg]:size-3.5",
  fun: "border-fun-line bg-background min-h-[34px] gap-1 border px-2 text-xs font-semibold [&_svg]:text-fun-accent-violet [&_svg]:size-3.5",
} as const;

/**
 * "Simpler" and "Go deeper", as they sit under a lesson screen. A label never breaks inside its
 * chip: when both don't fit on one line, the second chip moves to the next one.
 */
export async function DepthChips({
  className,
  variant = "focus",
}: {
  className?: string;
  variant?: keyof typeof CHIP_CLASS;
}) {
  const t = await getExtracted();

  const chipClass = cn(
    "inline-flex items-center rounded-full py-1 whitespace-nowrap [&_svg]:flex-none",
    CHIP_CLASS[variant],
  );

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      <span className={chipClass}>
        <FeatherIcon />
        {t("Simpler")}
      </span>
      <span className={chipClass}>
        <LayersIcon />
        {t("Go deeper")}
      </span>
    </div>
  );
}
