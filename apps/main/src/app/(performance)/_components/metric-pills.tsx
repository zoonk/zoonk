"use client";

import { getMenu } from "@/lib/menu";
import { buttonVariants } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

export function MetricPillLinks() {
  const segment = useSelectedLayoutSegment();
  const t = useExtracted();

  const energy = getMenu("energy");
  const level = getMenu("level");
  const score = getMenu("score");

  return (
    <>
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
    </>
  );
}
