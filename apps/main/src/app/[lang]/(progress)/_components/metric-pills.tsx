"use client";

import { Link } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";
import { buttonVariants } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { useSelectedLayoutSegment } from "next/navigation";

export function MetricPillLinks() {
  const segment = useSelectedLayoutSegment();
  const t = useExtracted();

  const items = [
    { label: t("Activity"), segment: "activity", ...getMenu("activity") },
    { label: t("Energy"), segment: "energy", ...getMenu("energy") },
    { label: t("Level"), segment: "level", ...getMenu("level") },
    { label: t("Score"), segment: "score", ...getMenu("score") },
  ];

  return items.map((item) => (
    <Link
      aria-current={segment === item.segment ? "page" : undefined}
      className={buttonVariants({
        size: "sm",
        variant: segment === item.segment ? "default" : "outline",
      })}
      href={item.url}
      key={item.segment}
      prefetch
    >
      <item.icon aria-hidden className="size-4" />
      {item.label}
    </Link>
  ));
}
