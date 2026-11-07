"use client";

import { useIsMounted } from "@zoonk/ui/hooks/is-mounted";
import { OPEN_PAGE_HERE_SCRIPT } from "@zoonk/ui/lib/open-page-here-script";

/**
 * Opens a server-rendered page at the element it's placed in, before the browser first paints it,
 * so its caller skips its own first scroll when hydrating. Renders nothing in a client render, where
 * a script never runs and the caller places the page itself.
 */
export function OpenPageHere() {
  const mounted = useIsMounted();

  if (mounted) {
    return null;
  }

  return (
    <script
      // oxlint-disable-next-line react/no-danger -- A fixed script that must run before the first paint.
      dangerouslySetInnerHTML={{ __html: OPEN_PAGE_HERE_SCRIPT }}
    />
  );
}
