/** Text a snippet button adds: `before` goes in front of the selection, `after` behind it. */
export type CodeSnippet = { after?: string; before: string };

/**
 * Inserts a snippet at the cursor, wrapping any selected text (so `( )` around a selection
 * groups it), and returns where the cursor goes: after the selection, before the closing part.
 */
export function insertAtCursor({
  selectionEnd,
  selectionStart,
  snippet,
  value,
}: {
  selectionEnd: number;
  selectionStart: number;
  snippet: CodeSnippet;
  value: string;
}): { cursor: number; value: string } {
  const [start, end] = [
    Math.max(0, Math.min(selectionStart, selectionEnd, value.length)),
    Math.min(value.length, Math.max(selectionStart, selectionEnd)),
  ];

  const selected = value.slice(start, end);
  const inserted = `${snippet.before}${selected}${snippet.after ?? ""}`;

  return {
    cursor: start + snippet.before.length + selected.length,
    value: `${value.slice(0, start)}${inserted}${value.slice(end)}`,
  };
}
