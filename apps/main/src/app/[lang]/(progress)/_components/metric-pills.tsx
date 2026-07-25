"use client";

import { Link } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";
import { buttonVariants } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { useSelectedLayoutSegment } from "next/navigation";
import { useEffect, useRef } from "react";

/** Preserves the reveal without animating for users who reduce motion. */
function getMetricPillScrollBehavior(): ScrollBehavior {
  return globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

/** Keeps the selected progress metric visible when its route opens. */
export function MetricPillLinks() {
  const segment = useSelectedLayoutSegment();
  const t = useExtracted();
  const activeLinkRef = useRef<HTMLAnchorElement>(null);

  const items = [
    { label: t("Activity"), segment: "activity", ...getMenu("activity") },
    { label: t("Score"), segment: "score", ...getMenu("score") },
    { label: t("Patterns"), segment: "patterns", ...getMenu("patterns") },
    { label: t("Level"), segment: "level", ...getMenu("level") },
    { label: t("Energy"), segment: "energy", ...getMenu("energy") },
  ];

  useEffect(() => {
    activeLinkRef.current?.scrollIntoView({
      behavior: getMetricPillScrollBehavior(),
      block: "nearest",
      inline: "center",
    });
  }, [segment]);

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
      ref={segment === item.segment ? activeLinkRef : undefined}
    >
      <item.icon aria-hidden className="size-4" />
      {item.label}
    </Link>
  ));
}
