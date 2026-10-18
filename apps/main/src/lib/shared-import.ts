/**
 * A dynamic import held once per tab, for code more than one page loads on its own. Turbopack
 * loads a dynamic import's chunks per page, so code one page already loaded would be downloaded
 * again by the next page, whose view would wait for it. Every page asks through the same holder
 * instead, and gets the load already done (or under way). A load that failed (offline for a
 * moment) is forgotten, so the next one tries again.
 */
export function createSharedImport<Module>() {
  let held: Promise<Module> | undefined;

  return (load: () => Promise<Module>): Promise<Module> => {
    if (held) {
      return held;
    }

    const loading = load();
    held = loading;

    loading.catch(() => {
      if (held === loading) {
        held = undefined;
      }
    });

    return loading;
  };
}
