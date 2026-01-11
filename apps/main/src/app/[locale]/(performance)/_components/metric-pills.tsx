"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { useSelectedLayoutSegment } from "next/navigation";
import { useExtracted } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";

export function MetricPills() {
  const segment = useSelectedLayoutSegment();
  const t = useExtracted();

  const energy = getMenu("energy");
  const level = getMenu("level");
  const score = getMenu("score");

  return (
    <div className="flex gap-2 overflow-x-auto overflow-y-hidden pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Link
        className={buttonVariants({
          size: "sm",
          variant: segment === "energy" ? "default" : "outline",
        })}
        href={energy.url}
      >
        <energy.icon aria-hidden className="size-4" />
        {t("Energy")}
      </Link>

      <Link
        className={buttonVariants({
          size: "sm",
          variant: segment === "level" ? "default" : "outline",
        })}
        href={level.url}
      >
        <level.icon aria-hidden className="size-4" />
        {t("Level")}
      </Link>

      <Link
        className={buttonVariants({
          size: "sm",
          variant: segment === "score" ? "default" : "outline",
        })}
        href={score.url}
      >
        <score.icon aria-hidden className="size-4" />
        {t("Score")}
      </Link>
    </div>
  );
}
