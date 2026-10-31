/**
 * Turbopack loads a dynamic import's chunks per page, so the next page would download them again.
 * A load that failed is forgotten, so the next one tries again.
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
