import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { ArrowRightIcon } from "lucide-react";
import { type ReactNode } from "react";

/**
 * Marks why a start control's action didn't go through, shown under it: the start row's short
 * note steps aside for it, since the reason matters more than the reassurance.
 */
export const START_FAILURE_SLOT = "start-failure";

const START_CONTROL_CLASS = "px-5 font-[560]";

/** The look of a public page's one action: a large button with an arrow after its label. */
export function getStartControlClassName(className?: string) {
  return cn(buttonVariants({ size: "lg" }), START_CONTROL_CLASS, className);
}

/**
 * A start that isn't the page's main action, such as a lesson's plan under its first question:
 * the same shape, see-through with the stronger line.
 */
export function getSecondaryStartControlClassName() {
  return cn(buttonVariants({ size: "lg", variant: "outline" }), START_CONTROL_CLASS);
}

/**
 * A public page's one action as a large button. The destination is a plain URL (the player or
 * onboarding), so it's a native link.
 */
export function StartLink({
  children,
  className,
  href,
  id,
}: {
  children: ReactNode;
  className?: string;
  href: string;
  id?: string;
}) {
  return (
    <a className={getStartControlClassName(className)} href={href} id={id}>
      {children}
      <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
    </a>
  );
}

/**
 * A page's one next step (`children`, its control), with a short line on what it takes. It opens
 * the first screen's space under the title by default; `className` places it elsewhere.
 */
export function StartBlock({
  children,
  className,
  note,
}: {
  children: ReactNode;
  className?: string;
  note?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mt-7 flex flex-col items-stretch gap-3 sm:mt-9 sm:flex-row sm:items-center sm:gap-5 [&:has([data-slot=start-failure])>[data-slot=start-note]]:hidden",
        className,
      )}
    >
      {children}

      {note && (
        <p
          className="text-muted-foreground text-center text-[13px] sm:text-left sm:text-sm"
          data-slot="start-note"
        >
          {note}
        </p>
      )}
    </div>
  );
}
