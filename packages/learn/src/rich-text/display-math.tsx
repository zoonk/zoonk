"use client";

import { useEffect, useRef, useState } from "react";
import { useSpokenMath } from "./spoken-math";

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

export function DisplayMath({ children }: { children: React.ReactNode }) {
  const spoken = useSpokenMath();
  const { contentRef, scrollerRef, scrolls } = useScrollsSideways();

  return (
    <span
      className="has-focus-visible:ring-ring/50 -mx-1 my-2 block rounded-md has-focus-visible:ring-[3px]"
      data-slot="display-math"
    >
      <span
        className="scroll-fade-x block overflow-x-auto overflow-y-hidden p-1 outline-none"
        ref={scrollerRef}
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- A formula wider than its column scrolls sideways, which needs focus by keyboard, and WebKit doesn't give a scroller focus (https://bugs.webkit.org/show_bug.cgi?id=277290). Inside a name, such as an answer option, it would be a second tab stop in a control.
        tabIndex={scrolls && !spoken ? 0 : undefined}
      >
        <span className="block w-max min-w-full" ref={contentRef}>
          {children}
        </span>
      </span>
    </span>
  );
}
