"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { SNAP_ROW_CLASS } from "./landing-styles";
import { useScrollRowFocus } from "./use-scroll-row-focus";

const FRAMES_ACROSS_CLASS =
  "md:mx-0 md:grid-flow-row md:auto-cols-auto md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 md:pb-0 lg:gap-5";

/** Give it an `aria-label`: the row scrolls on phones and takes focus. */
export function Frames({ className, ...props }: React.ComponentProps<"ol">) {
  const ref = useScrollRowFocus<HTMLOListElement>();

  return (
    <ol
      className={cn(SNAP_ROW_CLASS, FRAMES_ACROSS_CLASS, className)}
      data-slot="frames"
      ref={ref}
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
