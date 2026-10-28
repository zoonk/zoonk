"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useId } from "react";
import { PlusMark } from "../_components/plus-lock";
import { SURFACE_CLASS } from "../_components/surface";
import { LearnLink } from "../learn-link";

export const TUTOR_CARD_WIDTH_CLASS = "w-full max-w-130";

export function OfferCard({
  children,
  description,
  locked = false,
  tile,
  title,
}: {
  children: React.ReactNode;
  description: React.ReactNode;
  locked?: boolean;
  tile: React.ReactNode;
  title: string;
}) {
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className={cn(SURFACE_CLASS, TUTOR_CARD_WIDTH_CLASS, "flex flex-col gap-3 p-3")}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-5 shrink-0 items-center">{tile}</span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1" id={titleId}>
            <span className="text-sm font-medium text-balance">{title}</span>
            {locked && <PlusMark />}
          </h3>
          <p className="text-muted-foreground text-[0.8125rem] text-pretty">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export function OfferLink({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <LearnLink
      className={buttonVariants({ className: "self-start", size: "sm", variant: "outline" })}
      href={href}
    >
      {children}
    </LearnLink>
  );
}

export function OfferTile({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "text-muted-foreground flex size-4 shrink-0 items-center justify-center [&_svg]:size-4",
        className,
      )}
    >
      {children}
    </span>
  );
}
