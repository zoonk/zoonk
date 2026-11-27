import { HELD_PRESS_SCRIPT } from "@zoonk/ui/lib/held-press-script";

/** In `<head>`, so it listens before any control paints. */
export function HeldPressScript() {
  return (
    <script
      // oxlint-disable-next-line react/no-danger -- A fixed script that must run before the first paint.
      dangerouslySetInnerHTML={{ __html: HELD_PRESS_SCRIPT }}
    />
  );
}
