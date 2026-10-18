import { use } from "react";
import { type MathMarkupRenderer, mathMarkupKey } from "./math-key";
import { MathMarkupContext } from "./math-markup-context";

let renderer: MathMarkupRenderer | null = null;
let loading: Promise<MathMarkupRenderer | null> | null = null;

/**
 * Loads KaTeX, so a screen with math downloads it before its formulas show. A chunk that fails to
 * load (offline, a stale deploy) leaves them as written, and the next formula tries again.
 *
 * @public Browser bundles resolve `#math-renderer` here (its `browser` condition), which Knip
 * doesn't follow.
 */
export function preloadMathRenderer(): Promise<MathMarkupRenderer | null> {
  loading ??= import("./math-markup").then(
    (module) => {
      renderer = module.renderMathMarkup;
      return renderer;
    },
    () => {
      loading = null;
      return null;
    },
  );

  return loading;
}

/**
 * A formula's MathML in the browser: as the server drew it ahead (`MathMarkupProvider`), or drawn
 * by KaTeX, suspending the formula until it arrives (hydration keeps the server's drawing
 * meanwhile). Null when KaTeX couldn't load.
 *
 * @public Browser bundles resolve `#math-renderer` here (its `browser` condition), which Knip
 * doesn't follow.
 */
export function useMathMarkup(formula: { displayMode: boolean; text: string }): string | null {
  const drawn = use(MathMarkupContext)?.[mathMarkupKey(formula)];

  if (drawn !== undefined) {
    return drawn;
  }

  const render = renderer ?? use(preloadMathRenderer());
  return render ? render(formula) : null;
}
