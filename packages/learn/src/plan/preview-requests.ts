/**
 * Which preview request is still wanted. A newer request or a cancel (Not now, paging, closing the
 * sheet, replacing the suggestion, leaving the screen) makes an earlier one stale: its answer
 * still settles the state, which ignores it, but resolves to `null` for whoever awaited it, so a
 * caller that acts on the answer acts only on a wanted one.
 */
export function createPreviewRequests(onDrop: () => void) {
  let active: object | null = null;
  let opening: string | undefined;
  let base: object | undefined;

  const cancel = () => {
    active = null;
    onDrop();
  };

  return {
    cancel,
    run: async <T>(request: object, load: () => Promise<T>): Promise<T | null> => {
      active = request;
      const result = await load();
      return active === request ? result : null;
    },
    showBase: (shown: object) => {
      if (base !== shown) {
        base = shown;
        cancel();
      }
    },
    showOpening: (shown: string | undefined) => {
      if (opening !== shown) {
        opening = shown;
        cancel();
      }
    },
  };
}
