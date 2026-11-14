/**
 * Which preview request is still wanted. A newer request or a cancel (Not now, paging, closing)
 * makes an earlier one stale: its answer still settles the state, which ignores it, but resolves
 * to `null` for whoever awaited it, so a caller that acts on the answer acts only on a wanted one.
 */
export function createPreviewRequests() {
  let active: object | null = null;

  return {
    cancel: () => {
      active = null;
    },
    run: async <T>(request: object, load: () => Promise<T>): Promise<T | null> => {
      active = request;
      const result = await load();
      return active === request ? result : null;
    },
  };
}
