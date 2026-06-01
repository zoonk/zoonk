"use client";

import { type MouseEvent } from "react";

/**
 * Catalog anchors are queried through CSS selectors, so ids must be escaped
 * before interpolation to keep unusual future keys from breaking shortcuts.
 */
function getCatalogScrollTargetElement(targetId: string) {
  return globalThis.document.querySelector(`#${globalThis.CSS.escape(targetId)}`);
}

/**
 * Users who reduce motion should still get the same destination without the
 * animated movement that can make scrolling feel uncomfortable.
 */
function getCatalogScrollBehavior(): ScrollBehavior {
  if (globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return "auto";
  }

  return "smooth";
}

/**
 * Catalog shortcut links keep a normal hash href as their no-JS fallback, but
 * hydrated clicks use controlled scrolling so sidebar and floating shortcuts
 * feel consistent.
 */
function handleCatalogSmoothScrollClick({
  event,
  targetId,
}: {
  event: MouseEvent<HTMLAnchorElement>;
  targetId: string;
}) {
  const catalogScrollTarget = getCatalogScrollTargetElement(targetId);

  if (!catalogScrollTarget) {
    return;
  }

  event.preventDefault();
  catalogScrollTarget.scrollIntoView({ behavior: getCatalogScrollBehavior(), block: "start" });
}

export function CatalogSmoothScrollLink({
  children,
  targetId,
  ...props
}: Omit<React.ComponentProps<"a">, "href" | "onClick"> & { targetId: string }) {
  return (
    <a
      href={`#${targetId}`}
      onClick={(event) => handleCatalogSmoothScrollClick({ event, targetId })}
      {...props}
    >
      {children}
    </a>
  );
}
