"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { XIcon } from "lucide-react";
import { type Route } from "next";
import { useExtracted } from "next-intl";
import Link from "next/link";

export function PlayerHeader({ className, ...props }: React.ComponentProps<"header">) {
  return (
    <header
      className={cn(
        "relative flex items-center justify-between px-3 py-1.5 sm:py-2.5 xl:p-4",
        className,
      )}
      data-slot="player-header"
      {...props}
    />
  );
}

export function PlayerCloseLink<T extends string>({
  className,
  href,
}: {
  className?: string;
  href: Route<T>;
}) {
  const t = useExtracted();

  return (
    <Link className={cn(buttonVariants({ size: "icon", variant: "ghost" }), className)} href={href}>
      <XIcon />
      <span className="sr-only">{t("Close")}</span>
    </Link>
  );
}

export function PlayerStepFraction({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("text-muted-foreground text-sm tabular-nums", className)}
      data-slot="player-step-fraction"
      {...props}
    />
  );
}
