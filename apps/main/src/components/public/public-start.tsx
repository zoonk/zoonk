import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { ArrowRightIcon } from "lucide-react";
import { type ReactNode } from "react";

/** The start row's short note steps aside for it: the reason matters more than the reassurance. */
export const START_FAILURE_SLOT = "start-failure";

const START_CONTROL_CLASS = "px-5 font-[560]";

export function getStartControlClassName(className?: string) {
  return cn(buttonVariants({ size: "lg" }), START_CONTROL_CLASS, className);
}

export function getSecondaryStartControlClassName() {
  return cn(buttonVariants({ size: "lg", variant: "outline" }), START_CONTROL_CLASS);
}

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
