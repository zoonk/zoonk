/**
 * The player should emit the same UI regardless of whether device haptics are
 * available. This shim keeps the hook contract intact without side effects.
 */
export function useWebHaptics() {
  return {
    trigger() {
      return Promise.resolve();
    },
  };
}
