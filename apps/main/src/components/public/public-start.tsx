import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { ArrowRightIcon } from "lucide-react";
import { type ReactNode } from "react";
import { PUBLIC_CLOSING_START_ID, PUBLIC_FOOTER_ID, PUBLIC_START_ID } from "./public-ids";
import { StickyStartBar } from "./sticky-start-bar";

/**
 * Marks why a start control's action didn't go through, shown under it: the start row's short
 * note steps aside for it, since the reason matters more than the reassurance.
 */
export const START_FAILURE_SLOT = "start-failure";

/** The look of a public page's one action: a large button with an arrow after its label. */
export function getStartControlClassName(className?: string) {
  return cn(buttonVariants({ size: "lg" }), "h-12 px-5 text-base", className);
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
 * On phones, the page's one action (`children`, its control) follows the reader in a bottom bar
 * once the page's own start control scrolls away, and steps aside while the closing call or the
 * footer is on screen.
 */
export function StickyStart({ children }: { children: ReactNode }) {
  return (
    <StickyStartBar
      afterId={PUBLIC_START_ID}
      hideWhileVisibleIds={[PUBLIC_CLOSING_START_ID, PUBLIC_FOOTER_ID]}
    >
      {children}
    </StickyStartBar>
  );
}

/**
 * A page's one next step in its first screen (`children`, its control), with a short line on what
 * it takes. It's the control the phone's bottom start bar waits to scroll away.
 */
export function StartBlock({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div
      className="mt-7 flex flex-col items-stretch gap-3 sm:mt-9 sm:flex-row sm:items-center sm:gap-5 [&:has([data-slot=start-failure])>[data-slot=start-note]]:hidden"
      id={PUBLIC_START_ID}
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

/**
 * A course's or chapter's one next step (`start`, its control), which follows the reader on
 * phones.
 */
export function PublicStart({ note, start }: { note?: ReactNode; start: ReactNode }) {
  return (
    <>
      <StartBlock note={note}>{start}</StartBlock>
      <StickyStart>{start}</StickyStart>
    </>
  );
}
