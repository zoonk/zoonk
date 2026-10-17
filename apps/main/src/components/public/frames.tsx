"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { SNAP_ROW_CLASS } from "./landing-styles";
import { useScrollRowFocus } from "./use-scroll-row-focus";

/** From `md` the steps sit side by side, as the swipe row does from `lg`. */
const FRAMES_ACROSS_CLASS =
  "md:mx-0 md:grid-flow-row md:auto-cols-auto md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 md:pb-0 lg:gap-5";

/**
 * Something that happens in steps, as a sequence of frames, each with its number and a caption
 * under it: a row that swipes on phones, three across from `md`, so the last step (the payoff)
 * never waits as a sliver at a row's edge. `aria-label` names
 * the sequence, since the row scrolls and takes the keyboard's focus.
 */
export function Frames({ className, ...props }: React.ComponentProps<"ol">) {
  const ref = useScrollRowFocus<HTMLOListElement>();

  return (
    <ol
      className={cn(SNAP_ROW_CLASS, FRAMES_ACROSS_CLASS, className)}
      data-slot="frames"
      ref={ref}
      // The row scrolls on phones, so the keyboard can reach it there (and only there).
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- A scrolling list takes focus to scroll.
      tabIndex={0}
      {...props}
    />
  );
}

export function Frame({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      className={cn("flex min-w-0 snap-start flex-col gap-4", className)}
      data-slot="frame"
      {...props}
    />
  );
}

/** The frame's number ("01") and what happens in it. */
export function FrameCaption({
  children,
  className,
  number,
}: {
  children: React.ReactNode;
  className?: string;
  number: number;
}) {
  return (
    <p className={cn("flex gap-2.5 text-sm leading-5 text-pretty", className)}>
      <span aria-hidden="true" className="text-faint font-mono tabular-nums">
        {String(number).padStart(2, "0")}
      </span>
      <span>{children}</span>
    </p>
  );
}
