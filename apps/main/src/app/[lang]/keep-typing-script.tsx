import { KEEP_TYPING_SCRIPT } from "@zoonk/learn/kept-typing-script";

/**
 * The keeper of words typed before a field's code arrives (a slow device), in every page's
 * `<head>` so it listens before any field paints. The fields take the words once their code runs
 * (`useKeptTyping`).
 */
export function KeepTypingScript() {
  return (
    <script
      // oxlint-disable-next-line react/no-danger -- A fixed script that must run before the first paint.
      dangerouslySetInnerHTML={{ __html: KEEP_TYPING_SCRIPT }}
    />
  );
}
