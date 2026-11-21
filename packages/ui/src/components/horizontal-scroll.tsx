"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { buttonVariants } from "./button";

/**
 * The row's own small button, as tall as the chips it scrolls, at the row's end over the fade.
 * `--scroll-inset` is the row's side padding, so the button ends on the column.
 */
const SCROLL_BUTTON_CLASS = cn(
  buttonVariants({ size: "icon-sm", variant: "outline" }),
  "bg-background hover:bg-muted absolute top-0 z-10 pointer-coarse:hidden",
);

/**
 * A row of chips or tabs wider than its room: the cut edge fades out, and with a mouse a chevron
 * button on that edge, on the chips' line, scrolls it (`labels` name the two). Anything else that
 * can be wider than its room (a table, a program, a keyboard) is a `SidewaysScroll`, which puts
 * nothing over what it scrolls. What scrolls is measured from its children's boxes, so a child is
 * as wide as its content (`w-max` or `min-w-max`), not cut by its own width.
 */
function HorizontalScroll({
  className,
  children,
  labels,
  ...props
}: React.ComponentProps<"div"> & { labels: { left: string; right: string } }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;

    if (!el) {
      return;
    }

    // Measured from its children's boxes, not `scrollWidth`: a small last item's `hit-area` reaches
    // past it and would read as content that scrolls.
    const checkScroll = () => {
      const left = el.getBoundingClientRect().left - el.scrollLeft;

      const reach = Math.max(
        0,
        ...Array.from(el.children, (child) => child.getBoundingClientRect().right - left),
      );

      setCanScrollLeft(el.scrollLeft > 1);
      setCanScrollRight(el.scrollLeft < reach - el.clientWidth - 1);
    };

    checkScroll();

    // The content is watched too: typing a longer line widens it without resizing the box.
    const observer = new ResizeObserver(checkScroll);
    observer.observe(el);

    for (const child of el.children) {
      observer.observe(child);
    }

    el.addEventListener("scroll", checkScroll, { passive: true });

    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", checkScroll);
    };
  }, []);

  function scroll(direction: "left" | "right") {
    scrollRef.current?.scrollBy({ behavior: "smooth", left: direction === "left" ? -200 : 200 });
  }

  return (
    <div className={cn("relative", className)} data-slot="horizontal-scroll" {...props}>
      <div
        className={cn(
          "scrollbar-none overflow-x-auto overflow-y-hidden [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden",
          canScrollLeft &&
            canScrollRight &&
            "mask-[linear-gradient(to_right,transparent,black_64px,black_calc(100%-64px),transparent)]",
          canScrollLeft &&
            !canScrollRight &&
            "mask-[linear-gradient(to_right,transparent,black_64px)]",
          !canScrollLeft &&
            canScrollRight &&
            "mask-[linear-gradient(to_right,black_calc(100%-64px),transparent)]",
        )}
        ref={scrollRef}
      >
        {children}
      </div>

      {canScrollLeft && (
        <button
          aria-label={labels.left}
          className={cn(SCROLL_BUTTON_CLASS, "left-(--scroll-inset,0px)")}
          onClick={() => scroll("left")}
          type="button"
        >
          <ChevronLeft />
        </button>
      )}

      {canScrollRight && (
        <button
          aria-label={labels.right}
          className={cn(SCROLL_BUTTON_CLASS, "right-(--scroll-inset,0px)")}
          onClick={() => scroll("right")}
          type="button"
        >
          <ChevronRight />
        </button>
      )}
    </div>
  );
}

function HorizontalScrollContent({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex w-max min-w-full gap-2 px-(--scroll-inset,0px) pb-2", className)}
      data-slot="horizontal-scroll-content"
      {...props}
    >
      {children}
    </div>
  );
}

export { HorizontalScroll, HorizontalScrollContent };
