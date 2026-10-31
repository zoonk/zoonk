import { KEEP_TYPING_SCRIPT } from "@zoonk/learn/kept-typing-script";

/** In `<head>`, so it listens before any field paints. */
export function KeepTypingScript() {
  return (
    <script
      // oxlint-disable-next-line react/no-danger -- A fixed script that must run before the first paint.
      dangerouslySetInnerHTML={{ __html: KEEP_TYPING_SCRIPT }}
    />
  );
}
