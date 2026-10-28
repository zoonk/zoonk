"use client";

import { useEffect, useRef } from "react";

export type Answered = boolean | string;

export function useFocusOnAnswer({
  answered,
  focusOnMount,
  section,
}: {
  answered: Answered;
  focusOnMount: boolean;
  section: React.RefObject<HTMLElement | null>;
}) {
  const previous = useRef(focusOnMount ? null : answered);

  useEffect(() => {
    if ((answered || focusOnMount) && answered !== previous.current) {
      section.current?.focus();
    }

    previous.current = answered;
  }, [answered, focusOnMount, section]);
}

export function useFocusOnRemovedControl(section: React.RefObject<HTMLElement | null>) {
  const control = useRef<Element | null>(null);

  useEffect(() => {
    const element = section.current;

    const remember = (event: FocusEvent) => {
      control.current = event.target instanceof Element ? event.target : null;
    };

    element?.addEventListener("focusin", remember);
    return () => element?.removeEventListener("focusin", remember);
  }, [section]);

  useEffect(() => {
    const lost = document.activeElement === document.body;

    if (lost && control.current && !control.current.isConnected) {
      section.current?.focus();
    }
  });
}
