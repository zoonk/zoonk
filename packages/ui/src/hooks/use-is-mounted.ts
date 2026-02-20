import { useSyncExternalStore } from "react";

// oxlint-disable-next-line no-empty-function -- useSyncExternalStore requires a subscribe that returns an unsubscribe
const subscribe = () => () => {};

export function useIsMounted() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
