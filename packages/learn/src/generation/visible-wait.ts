export type WaitSegment = { startedAt: number; endedAt: number };

export function createVisibleWait({ at, visible }: { at: number; visible: boolean }) {
  const state: { startedAt: number | null } = { startedAt: visible ? at : null };

  return {
    end(endedAt: number): WaitSegment | null {
      const since = state.startedAt;
      state.startedAt = null;
      return since !== null && endedAt > since ? { endedAt, startedAt: since } : null;
    },
    show(shownAt: number) {
      state.startedAt ??= shownAt;
    },
  };
}
