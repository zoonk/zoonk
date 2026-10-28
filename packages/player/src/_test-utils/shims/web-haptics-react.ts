export function useWebHaptics() {
  return {
    trigger() {
      return Promise.resolve();
    },
  };
}
