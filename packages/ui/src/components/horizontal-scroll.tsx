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
  "bg-background hover:bg-muted absolute z-10 pointer-coarse:hidden",
);

const BUTTON_PLACE_CLASS = { box: "top-1/2 -translate-y-1/2", row: "top-0" } as const;

/**
 * The one way the web says something is wider than its room: the cut edge fades out, and with a
 * mouse a chevron button on that edge scrolls it (`labels` name the two). A row of chips keeps the
 * buttons on the chips' line. A `box` (a table, a code block, a keyboard) centers them on its
 * height and takes keyboard focus itself, since nothing inside it does; its `label` says what
 * scrolls.
 */
function HorizontalScroll({
  box,
  className,
  children,
  labels,
  ...props
}: React.ComponentProps<"div"> & {
  box?: { label: string };
  labels: { left: string; right: string };
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;

    if (!el) {
      return;
    }

    const checkScroll = () => {
      setCanScrollLeft(el.scrollLeft > 1);
      setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
    };

    checkScroll();

    const observer = new ResizeObserver(checkScroll);
    observer.observe(el);
    el.addEventListener("scroll", checkScroll, { passive: true });

    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", checkScroll);
    };
  }, []);

  const place = box ? "box" : "row";

  function scroll(direction: "left" | "right") {
    scrollRef.current?.scrollBy({ behavior: "smooth", left: direction === "left" ? -200 : 200 });
  }

  return (
    <div className={cn("relative", className)} data-slot="horizontal-scroll" {...props}>
      <div
        aria-label={box?.label}
        className={cn(
          "scrollbar-none overflow-x-auto overflow-y-hidden [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden",
          box && "focus-visible:ring-ring/50 rounded-lg outline-none focus-visible:ring-[3px]",
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
        role={box ? "group" : undefined}
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- What scrolls must be reachable by keyboard when nothing inside it takes focus.
        tabIndex={box ? 0 : undefined}
      >
        {children}
      </div>

      {canScrollLeft && (
        <button
          aria-label={labels.left}
          className={cn(
            SCROLL_BUTTON_CLASS,
            BUTTON_PLACE_CLASS[place],
            "left-(--scroll-inset,0px)",
          )}
          onClick={() => scroll("left")}
          type="button"
        >
          <ChevronLeft />
        </button>
      )}

      {canScrollRight && (
        <button
          aria-label={labels.right}
          className={cn(
            SCROLL_BUTTON_CLASS,
            BUTTON_PLACE_CLASS[place],
            "right-(--scroll-inset,0px)",
          )}
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
