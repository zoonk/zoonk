"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useEffect, useRef, useState } from "react";

const FOCUSABLE =
  "a[href],button:enabled,input:enabled,select:enabled,textarea:enabled,[tabindex]:not([tabindex='-1'])";

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

    // What's inside can be swapped for wider content (a program's next output) or stop taking
    // focus (keys disabled after Check), so each change is checked again.
    const resized = new ResizeObserver(check);

    const watch = () => {
      resized.disconnect();
      resized.observe(box);

      for (const child of box.children) {
        resized.observe(child);
      }

      check();
    };

    watch();

    const changed = new MutationObserver(watch);

    changed.observe(box, {
      attributeFilter: ["disabled", "href", "tabindex"],
      childList: true,
      subtree: true,
    });

    return () => {
      resized.disconnect();
      changed.disconnect();
    };
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
 * Anything wider than its room (a table, a program, a keyboard) scrolls sideways as any scroller
 * does (its bar, a trackpad, Shift and the wheel), and each cut edge fades out. Nothing sits over
 * what scrolls, so all of it can be read and pressed. By keyboard, it takes focus while it scrolls
 * and nothing inside it can (`label` says what scrolls), and ←, →, Home and End move it. Its focus
 * ring is drawn inside the frame around it, over the content: on the scroller itself the fade would
 * hide it, and outside it a card's `overflow-hidden` would cut it.
 */
function SidewaysScroll({
  children,
  className,
  label,
  role = "group",
  ...props
}: Omit<React.ComponentProps<"div">, "role"> & { label: string; role?: "group" | "region" }) {
  const ref = useRef<HTMLDivElement>(null);
  const takesFocus = useTakesFocus(ref);

  return (
    <div
      className={cn(
        "has-[>[data-slot=sideways-scroll]:focus-visible]:outline-ring/50 min-w-0 rounded-lg has-[>[data-slot=sideways-scroll]:focus-visible]:outline-3 has-[>[data-slot=sideways-scroll]:focus-visible]:-outline-offset-3",
        className,
      )}
      data-slot="sideways-scroll-frame"
      {...props}
    >
      {/* oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- Its role is `group` or `region`. */}
      <div
        aria-label={label}
        className="scroll-fade-x overflow-x-auto overflow-y-hidden outline-none"
        data-slot="sideways-scroll"
        onKeyDown={scrollToEnd}
        ref={ref}
        role={role}
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- What scrolls must be reachable by keyboard when nothing inside it takes focus.
        tabIndex={takesFocus ? 0 : undefined}
      >
        {children}
      </div>
    </div>
  );
}

export { SidewaysScroll };
