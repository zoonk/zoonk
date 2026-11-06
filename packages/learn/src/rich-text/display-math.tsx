"use client";

import { useEffect, useRef, useState } from "react";
import { speakMath } from "./math-speech";
import { useMathWords } from "./use-spoken-text";

function useScrollsSideways() {
  const scrollerRef = useRef<HTMLSpanElement>(null);
  const contentRef = useRef<HTMLSpanElement>(null);
  const [scrolls, setScrolls] = useState(false);

  useEffect(() => {
    const scroller = scrollerRef.current;
    const content = contentRef.current;

    if (!scroller || !content) {
      return;
    }

    const observer = new ResizeObserver(() => {
      setScrolls(scroller.scrollWidth > scroller.clientWidth);
    });

    observer.observe(scroller);
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  return { contentRef, scrollerRef, scrolls };
}

export function DisplayMath({ children, latex }: { children: React.ReactNode; latex: string }) {
  const words = useMathWords();
  const { contentRef, scrollerRef, scrolls } = useScrollsSideways();

  return (
    <span
      className="has-focus-visible:ring-ring/50 -mx-1 my-2 block rounded-md has-focus-visible:ring-[3px]"
      data-slot="display-math"
    >
      <span
        aria-label={scrolls ? speakMath({ latex, words }) : undefined}
        className="scroll-fade-x block overflow-x-auto overflow-y-hidden p-1 outline-none"
        ref={scrollerRef}
        role={scrolls ? "region" : undefined}
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- A formula wider than its column scrolls sideways, which needs focus by keyboard, and WebKit doesn't give a scroller focus (https://bugs.webkit.org/show_bug.cgi?id=277290). As a region it keeps the arrow keys for scrolling instead of turning the screen.
        tabIndex={scrolls ? 0 : undefined}
      >
        <span className="block w-max min-w-full" ref={contentRef}>
          {children}
        </span>
      </span>
    </span>
  );
}
