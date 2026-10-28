import { use } from "react";
import { type MathMarkupRenderer, mathMarkupKey } from "./math-key";
import { MathMarkupContext } from "./math-markup-context";

type RendererLoad = Promise<MathMarkupRenderer | null> & {
  status?: "fulfilled";
  value?: MathMarkupRenderer | null;
};

let loading: RendererLoad | null = null;

/**
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
 * Null when KaTeX couldn't load.
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
