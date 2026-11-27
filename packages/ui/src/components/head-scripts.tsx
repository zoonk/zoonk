"use client";

import { HELD_PRESS_SCRIPT } from "@zoonk/ui/lib/held-press-script";
import { KEEP_TYPING_SCRIPT } from "@zoonk/ui/lib/kept-typing-script";
import { PENDING_LINK_SCRIPT } from "@zoonk/ui/patterns/links/pending";

/**
 * Scripts for the page's `<head>`, so they listen before anything paints. Client components, so a
 * page's RSC payload names each one instead of carrying its text again beside the HTML.
 */
function HeadScript({ script }: { script: string }) {
  // oxlint-disable-next-line react/no-danger -- A fixed script that must run before the first paint.
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}

export function HeldPressScript() {
  return <HeadScript script={HELD_PRESS_SCRIPT} />;
}

export function KeepTypingScript() {
  return <HeadScript script={KEEP_TYPING_SCRIPT} />;
}

/** So a link to another document, such as sign-in, shows it's on its way from the tap. */
export function PendingLinkScript() {
  return <HeadScript script={PENDING_LINK_SCRIPT} />;
}
