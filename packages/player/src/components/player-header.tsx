"use client";

import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronLeft, ChevronRight, XIcon } from "lucide-react";
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

export function PlayerCloseLink({ className, href }: { className?: string; href: string }) {
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

export function PlayerNav({ className, ...props }: React.ComponentProps<"nav">) {
  const t = useExtracted();

  return (
    <nav
      aria-label={t("Step navigation")}
      className={cn(
        "pointer-events-none absolute inset-x-0 flex items-center justify-center",
        className,
      )}
      {...props}
    />
  );
}

export function PlayerNavGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("pointer-events-auto flex items-center gap-1", className)} {...props} />
  );
}

export function PlayerNavButton({
  direction,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "size" | "variant"> & {
  direction: "prev" | "next";
}) {
  const t = useExtracted();
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  const label = direction === "prev" ? t("Previous step") : t("Next step");

  return (
    <Button aria-label={label} size="icon-sm" variant="ghost" {...props}>
      <Icon className="size-4" />
    </Button>
  );
}
