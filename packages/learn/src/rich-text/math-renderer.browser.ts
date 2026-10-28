import { use } from "react";
import { type MathMarkupRenderer, mathMarkupKey } from "./math-key";
import { MathMarkupContext } from "./math-markup-context";

/** KaTeX's load, marked settled the way `use` reads a promise once it has its renderer. */
type RendererLoad = Promise<MathMarkupRenderer | null> & {
  status?: "fulfilled";
  value?: MathMarkupRenderer | null;
};

let loading: RendererLoad | null = null;

/**
 * Loads KaTeX, so a screen with math downloads it before its formulas show. A chunk that fails to
 * load (offline, a stale deploy) leaves them as written, and the next formula tries again.
 *
 * @public Browser bundles resolve `#math-renderer` here (its `browser` condition), which Knip
 * doesn't follow.
 */
export function preloadMathRenderer(): Promise<MathMarkupRenderer | null> {
  if (!loading) {
    const load: RendererLoad = import("./math-markup").then(
      (module) => module.renderMathMarkup,
      () => {
        loading = null;
        return null;
      },
    );

    // `use` reads a promise marked settled at once, so formulas drawn after KaTeX arrived don't suspend.
    void load.then((render) => {
      load.status = "fulfilled";
      load.value = render;
    });

    loading = load;
  }

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

  // Always `use` on the load, even once KaTeX is here: React retries a formula that suspended on it
  // expecting the same call, and warns when it's skipped.
  const render = use(preloadMathRenderer());
  return render ? render(formula) : null;
}
