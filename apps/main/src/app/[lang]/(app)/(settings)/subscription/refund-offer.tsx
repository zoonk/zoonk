"use client";

import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted, useFormatter } from "next-intl";

/** Stopping the renewal keeps the 14-day refund open, so it stays one tap away. */
export function RefundOffer({ timeZone, until }: { timeZone: string; until: Date }) {
  const t = useExtracted();
  const format = useFormatter();

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">
        {t("Until {date}, you can still end Plus now and get a full refund.", {
          date: format.dateTime(until, { dateStyle: "long", timeZone }),
        })}
      </p>
      <Link
        className={cn(buttonVariants({ size: "sm", variant: "outline" }), "w-max")}
        href="/subscription/cancel?choice=withdrawal"
      >
        {t("Get a full refund")}
      </Link>
    </div>
  );
}
