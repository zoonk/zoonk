"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useEffect, useRef, useState } from "react";

const FOCUSABLE = "a[href],button,input,select,textarea,[tabindex]";

/**
 * The surface around a `SidewaysScroll` draws its focus ring: the scroller's own ring would fade
 * with its edges.
 */
const SIDEWAYS_SCROLL_FOCUS_CLASS =
  "has-[[data-slot=sideways-scroll]:focus-visible]:ring-ring/50 has-[[data-slot=sideways-scroll]:focus-visible]:ring-[3px]";

/** While it scrolls and nothing inside it takes focus, the box takes keyboard focus itself. */
function useTakesFocus(ref: React.RefObject<HTMLDivElement | null>, enabled: boolean): boolean {
  const [takesFocus, setTakesFocus] = useState(false);

  useEffect(() => {
    const box = ref.current;

    if (!box || !enabled) {
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
  }, [enabled, ref]);

  return enabled && takesFocus;
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
 * Anything wider than its room (a table, a program, a keyboard) scrolls sideways as any scroller
 * does (its bar, a trackpad, Shift and the wheel), and each cut edge fades out. Nothing sits over
 * what scrolls, so all of it can be read and pressed. With a `label`, it takes keyboard focus while
 * it scrolls and nothing inside it can, and ←, →, Home and End move it.
 */
function SidewaysScroll({
  className,
  label,
  role = "group",
  ...props
}: Omit<React.ComponentProps<"div">, "role"> & { label?: string; role?: "group" | "region" }) {
  const ref = useRef<HTMLDivElement>(null);
  const takesFocus = useTakesFocus(ref, label !== undefined);

  return (
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- Its role is `group` or `region` when it's named.
    <div
      aria-label={label}
      className={cn("scroll-fade-x overflow-x-auto overflow-y-hidden outline-none", className)}
      data-slot="sideways-scroll"
      onKeyDown={label === undefined ? undefined : scrollToEnd}
      ref={ref}
      role={label === undefined ? undefined : role}
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- What scrolls must be reachable by keyboard when nothing inside it takes focus.
      tabIndex={takesFocus ? 0 : undefined}
      {...props}
    />
  );
}

export { SIDEWAYS_SCROLL_FOCUS_CLASS, SidewaysScroll };
