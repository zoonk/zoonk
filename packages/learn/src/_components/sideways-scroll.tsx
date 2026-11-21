"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useEffect, useRef, useState } from "react";

const FOCUSABLE = "a[href],button,input,select,textarea,[tabindex]";

/** While it scrolls and nothing inside it takes focus, the box takes keyboard focus itself. */
function useTakesFocus(ref: React.RefObject<HTMLDivElement | null>): boolean {
  const [takesFocus, setTakesFocus] = useState(false);

  useEffect(() => {
    const box = ref.current;

    if (!box) {
      return;
    }

    const check = () => {
      setTakesFocus(box.scrollWidth > box.clientWidth + 1 && !box.querySelector(FOCUSABLE));
    };

    check();

    const observer = new ResizeObserver(check);
    observer.observe(box);

    for (const child of box.children) {
      observer.observe(child);
    }

    return () => observer.disconnect();
  }, [ref]);

  return takesFocus;
}

/** Home and End take the box to either end, as ← and → already move it. */
function scrollToEnd(event: React.KeyboardEvent<HTMLDivElement>) {
  const box = event.currentTarget;
  const end = { End: box.scrollWidth, Home: 0 }[event.key];
  const modified = event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;

  if (end === undefined || modified || event.target !== box) {
    return;
  }

  event.preventDefault();
  box.scrollTo({ left: getComputedStyle(box).direction === "rtl" ? -end : end });
}

/**
 * A table or a program wider than its room scrolls sideways as any scroller does (its bar, a
 * trackpad, Shift and the wheel), and each cut edge fades out. Nothing sits over what scrolls. By
 * keyboard, it takes focus while it scrolls (`label` says what scrolls), and ←, →, Home and End
 * move it.
 */
export function SidewaysScroll({
  className,
  label,
  role,
  ...props
}: Omit<React.ComponentProps<"div">, "role"> & { label: string; role: "group" | "region" }) {
  const ref = useRef<HTMLDivElement>(null);
  const takesFocus = useTakesFocus(ref);

  return (
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- Its role is the caller's `group` or `region`.
    <div
      aria-label={label}
      className={cn("scroll-fade-x overflow-x-auto outline-none", className)}
      data-slot="sideways-scroll"
      onKeyDown={scrollToEnd}
      ref={ref}
      role={role}
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- What scrolls must be reachable by keyboard when nothing inside it takes focus.
      tabIndex={takesFocus ? 0 : undefined}
      {...props}
    />
  );
}
