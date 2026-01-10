"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { CircleGaugeIcon, TargetIcon, ZapIcon } from "lucide-react";
import { useSelectedLayoutSegment } from "next/navigation";
import { useExtracted } from "next-intl";
import { Link } from "@/i18n/navigation";

export function MetricPills() {
  const segment = useSelectedLayoutSegment();
  const t = useExtracted();

  return (
    <div className="flex gap-2 overflow-x-auto overflow-y-hidden pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Link
        className={buttonVariants({
          size: "sm",
          variant: segment === "energy" ? "default" : "outline",
        })}
        href="/energy"
      >
        <ZapIcon aria-hidden className="size-4" />
        {t("Energy")}
      </Link>

      <Link
        className={buttonVariants({
          size: "sm",
          variant: segment === "belt" ? "default" : "outline",
        })}
        href="/belt"
      >
        <CircleGaugeIcon aria-hidden className="size-4" />
        {t("Belt")}
      </Link>

      <Link
        className={buttonVariants({
          size: "sm",
          variant: segment === "accuracy" ? "default" : "outline",
        })}
        href="/accuracy"
      >
        <TargetIcon aria-hidden className="size-4" />
        {t("Accuracy")}
      </Link>
    </div>
  );
}
