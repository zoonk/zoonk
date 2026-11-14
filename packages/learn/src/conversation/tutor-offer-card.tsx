"use client";

import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";
import { SubscribeGate } from "../_components/subscribe-gate";
import { SURFACE_CLASS } from "../_components/surface";
import { LearnLink } from "../learn-link";

export const TUTOR_CARD_WIDTH_CLASS = "w-full max-w-130";

export function OfferCard({
  children,
  description,
  note,
  ref,
  tile,
  title,
}: {
  children: React.ReactNode;
  description: React.ReactNode;
  /** How it went, in the description's place and type once the card is used. */
  note?: React.ReactNode;
  /** For a card whose button leaves once it's used, so focus can stay on the card. */
  ref?: React.Ref<HTMLElement>;
  tile: React.ReactNode;
  title: string;
}) {
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        SURFACE_CLASS,
        TUTOR_CARD_WIDTH_CLASS,
        "focus-visible:ring-ring/50 flex flex-col gap-3 p-3 outline-none focus-visible:ring-[3px]",
      )}
      ref={ref}
      tabIndex={-1}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-5 shrink-0 items-center">{tile}</span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="text-sm font-medium text-balance" id={titleId}>
            {title}
          </h3>
          {description && (
            <p className="text-muted-foreground text-compact text-pretty">{description}</p>
          )}
          {note}
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

function focusWayOn(gate: HTMLElement | null) {
  gate?.querySelector("a")?.focus();
}

/**
 * A card's one action. One the learner's plan doesn't include looks like any other: pressing it
 * puts the gate, titled `gate`, in its place.
 */
export function OfferAction({
  children,
  gate,
  href,
}: {
  children: React.ReactNode;
  gate: string | null;
  href: string;
}) {
  const [gated, setGated] = useState(false);

  if (!gate) {
    return <OfferLink href={href}>{children}</OfferLink>;
  }

  return gated ? (
    <div ref={focusWayOn}>
      <SubscribeGate title={gate} />
    </div>
  ) : (
    <OfferButton onClick={() => setGated(true)}>{children}</OfferButton>
  );
}

export function OfferButton({ className, ...props }: React.ComponentProps<typeof Button>) {
  return <Button className={cn("self-start", className)} size="sm" variant="outline" {...props} />;
}

/** The catalog's other "Practice" names a section, which some languages say differently from the verb. */
export function usePracticeVerb() {
  const t = useExtracted("offers");
  return t("Practice");
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
