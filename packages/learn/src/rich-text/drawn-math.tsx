import { collectMathMarkup } from "./math-markup";
import { MathMarkupProvider } from "./math-markup-context";

/**
 * Draws the formulas in `content` on the server, so a screen shows them typeset from its first
 * frame, client navigations included, without waiting for KaTeX.
 */
export function DrawnMath({ children, content }: { children: React.ReactNode; content: unknown }) {
  return <MathMarkupProvider markup={collectMathMarkup(content)}>{children}</MathMarkupProvider>;
}
