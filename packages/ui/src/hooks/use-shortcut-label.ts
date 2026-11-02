import { useIsMounted } from "./use-is-mounted";

export function isApplePlatform(): boolean {
  return /Mac|iPhone|iPad|iPod/u.test(navigator.userAgent);
}

/** Apple keyboards say ⌘ where the others say Ctrl; the server can't tell, so it says ⌘. */
export function useShortcutLabel(key: string): string {
  const isMounted = useIsMounted();
  const isApple = !isMounted || isApplePlatform();

  return isApple ? `⌘${key}` : `Ctrl ${key}`;
}
