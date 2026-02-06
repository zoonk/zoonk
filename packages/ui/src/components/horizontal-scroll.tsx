"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

function HorizontalScroll({ className, children, ...props }: React.ComponentProps<"div">) {
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

  function scroll(direction: "left" | "right") {
    scrollRef.current?.scrollBy({
      behavior: "smooth",
      left: direction === "left" ? -200 : 200,
    });
  }

  return (
    <div className={cn("relative", className)} data-slot="horizontal-scroll" {...props}>
      <div
        className={cn(
          "overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
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
          aria-label="Scroll left"
          className="border-border bg-background hover:bg-accent absolute top-1/2 left-3 z-10 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border shadow-sm transition-colors pointer-coarse:hidden"
          onClick={() => scroll("left")}
          type="button"
        >
          <ChevronLeft className="text-muted-foreground size-4" />
        </button>
      )}

      {canScrollRight && (
        <button
          aria-label="Scroll right"
          className="border-border bg-background hover:bg-accent absolute top-1/2 right-3 z-10 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border shadow-sm transition-colors pointer-coarse:hidden"
          onClick={() => scroll("right")}
          type="button"
        >
          <ChevronRight className="text-muted-foreground size-4" />
        </button>
      )}
    </div>
  );
}

function HorizontalScrollContent({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex gap-2 pb-1 after:w-4 after:shrink-0 after:content-['']", className)}
      data-slot="horizontal-scroll-content"
      {...props}
    >
      {children}
    </div>
  );
}

export { HorizontalScroll, HorizontalScrollContent };
