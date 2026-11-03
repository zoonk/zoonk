import { PENDING_LINK_SCRIPT } from "@zoonk/ui/patterns/links/pending";

/** In `<head>`, so a sign-in link tapped before hydration still shows it's on its way. */
export function PendingLinkScript() {
  return (
    <script
      // oxlint-disable-next-line react/no-danger -- A fixed script that must run before the first paint.
      dangerouslySetInnerHTML={{ __html: PENDING_LINK_SCRIPT }}
    />
  );
}
