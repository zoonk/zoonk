"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type PlayerRoute } from "../player-context";
import { PlayerLink } from "../player-link";

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

export function PlayerCloseLink({ className, href }: { className?: string; href: PlayerRoute }) {
  const t = useExtracted();

  return (
    <PlayerLink
      className={cn(buttonVariants({ size: "icon", variant: "ghost" }), className)}
      href={href}
    >
      <XIcon />
      <span className="sr-only">{t("Close")}</span>
    </PlayerLink>
  );
}
