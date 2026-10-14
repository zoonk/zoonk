/**
 * A dynamic import held once per tab, for code more than one page loads on its own. Turbopack
 * loads a dynamic import's chunks per page, so code one page already loaded would be downloaded
 * again by the next page, whose view would wait for it. Every page asks through the same holder
 * instead, and gets the load already done (or under way). A failed load stays failed, as
 * Turbopack keeps a chunk that didn't load failed until the page reloads.
 */
export function createSharedImport<Module>() {
  let held: Promise<Module> | undefined;

  return (load: () => Promise<Module>): Promise<Module> => {
    held ??= load();
    return held;
  };
}
