import { BusyContent } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { type ComponentProps, type ReactNode } from "react";

const PENDING_LINK_ATTRIBUTE = "data-pending-link";

/**
 * Runs inline in the page's `<head>`, so a tap shows at once even before the page hydrates.
 * Serialized with `toString`, so it may use only its argument and globals.
 */
function markPendingLinks(attribute: string) {
  // Captured, since React stops a click while it hydrates the part that was tapped; read after the
  // click is dispatched, so a handler that took it over has cancelled it by then.
  globalThis.addEventListener(
    "click",
    (event) => {
      const link = event.target instanceof Element ? event.target.closest(`a[${attribute}]`) : null;

      // A modified click opens a new tab or window, which leaves this page as it is.
      const isPlain =
        event.button === 0 && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;

      if (link && isPlain) {
        setTimeout(() => {
          if (!event.defaultPrevented) {
            link.setAttribute("aria-busy", "true");
          }
        }, 0);
      }
    },
    { capture: true },
  );

  // Going back restores the page as it was left, busy included.
  globalThis.addEventListener("pageshow", () => {
    for (const link of document.querySelectorAll(`a[${attribute}][aria-busy]`)) {
      link.removeAttribute("aria-busy");
    }
  });
}

export const PENDING_LINK_SCRIPT = `(${markPendingLinks.toString()})(${JSON.stringify(PENDING_LINK_ATTRIBUTE)})`;

/**
 * For a link that loads another document in this tab, such as sign-in on another site: the browser
 * keeps this page as it was until that one answers. With `PENDING_LINK_SCRIPT` in the page, the link
 * is busy from the tap, even before the page hydrates. It still takes another tap, which retries a
 * navigation the browser stopped (Esc, its stop button), since no `pageshow` clears the mark then.
 */
export function PendingLink({
  children,
  className,
  icon,
  ...props
}: ComponentProps<"a"> & { icon?: ReactNode }) {
  return (
    <a
      {...props}
      {...{ [PENDING_LINK_ATTRIBUTE]: "" }}
      className={cn(
        "group/busy relative aria-busy:cursor-progress [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      // The script marks a link tapped before the page hydrates.
      suppressHydrationWarning
    >
      <BusyContent icon={icon}>{children}</BusyContent>
    </a>
  );
}
