/**
 * Structured AI responses can over-escape LaTeX commands (`\\rightarrow`), which KaTeX reads as
 * text.
 */
export function normalizeLatexCommands(text: string) {
  return text.replaceAll(/\\\\[A-Za-z]+/gu, (escapedCommand) => escapedCommand.slice(1));
}
