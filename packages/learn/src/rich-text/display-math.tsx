"use client";

import { useEffect, useRef, useState } from "react";

/** A control stays one Tab stop: a stop inside it would take focus without pressing it. */
const CONTROL_SELECTOR = [
  "a[href]",
  "button",
  "label",
  "summary",
  "[role='button']",
  "[role='checkbox']",
  "[role='link']",
  "[role='option']",
  "[role='radio']",
  "[role='switch']",
  "[role='tab']",
].join(", ");

function useTakesKeyboard() {
  const scrollerRef = useRef<HTMLSpanElement>(null);
  const contentRef = useRef<HTMLSpanElement>(null);
  const [takesKeyboard, setTakesKeyboard] = useState(false);

  useEffect(() => {
    const scroller = scrollerRef.current;
    const content = contentRef.current;

    if (!scroller || !content || scroller.closest(CONTROL_SELECTOR)) {
      return;
    }

    const observer = new ResizeObserver(() => {
      setTakesKeyboard(scroller.scrollWidth > scroller.clientWidth);
    });

    observer.observe(scroller);
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  return { contentRef, scrollerRef, takesKeyboard };
}

export function DisplayMath({ children }: { children: React.ReactNode }) {
  const { contentRef, scrollerRef, takesKeyboard } = useTakesKeyboard();

  return (
    <span
      className="has-focus-visible:ring-ring/50 -mx-1 my-2 block rounded-md has-focus-visible:ring-[3px]"
      data-slot="display-math"
    >
      <span
        className="scroll-fade-x block overflow-x-auto overflow-y-hidden p-1 outline-none"
        ref={scrollerRef}
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- A formula wider than its column scrolls sideways, which needs focus by keyboard, and WebKit doesn't give a scroller focus (https://bugs.webkit.org/show_bug.cgi?id=277290).
        tabIndex={takesKeyboard ? 0 : undefined}
      >
        <span className="block w-max min-w-full" ref={contentRef}>
          {children}
        </span>
      </span>
    </span>
  );
}
