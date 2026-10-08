"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useId } from "react";
import { PlusMark } from "../_components/plus-lock";
import { SURFACE_CLASS } from "../_components/surface";
import { LearnLink } from "../learn-link";

/**
 * The card around a feature the buddy offered: its tile, what it is in a few words, and its button.
 * A feature the learner's plan doesn't include looks the same, marked Plus, with Plus's notice in
 * place of its button (`PlusNotice inset`).
 */
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
    <section aria-labelledby={titleId} className={cn(SURFACE_CLASS, "flex flex-col gap-3 p-4")}>
      <div className="flex items-start gap-3">
        {tile}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1" id={titleId}>
            <span className="font-medium text-balance">{title}</span>
            {locked && <PlusMark />}
          </h3>
          <p className="text-muted-foreground text-sm text-pretty">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

/** The card's way in: its feature's page. */
export function OfferLink({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <LearnLink
      className={buttonVariants({ className: "self-start", variant: "outline" })}
      href={href}
    >
      {children}
    </LearnLink>
  );
}

/**
 * The anchor of a feature that isn't one of the learning kinds (a new goal, statistics, memory):
 * its icon on a neutral tile, as small as a kind's tile on a card.
 */
export function OfferTile({
  children,
  className,
}: {
  children: React.ReactNode;
  /** A tint, for a feature whose rows elsewhere have one (pronunciation's). */
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4",
        className,
      )}
    >
      {children}
    </span>
  );
}
