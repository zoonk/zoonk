import { vi } from "vitest";

type RunEvent = { createdAt: Date; eventData?: { resumeAt?: Date }; eventType: string };

let lastEvents = new Map<string, RunEvent>();

export function mockLastRunEvent(runId: string, event: RunEvent): void {
  lastEvents.set(runId, event);
}

export function resetWorkflowRuntimeMock(): void {
  lastEvents = new Map();
}

export const getWorld = vi.fn(() =>
  Promise.resolve({
    events: {
      list: ({ runId }: { runId: string }) => {
        const event = lastEvents.get(runId);
        return Promise.resolve({ data: event ? [event] : [] });
      },
    },
    runs: { list: () => Promise.resolve({ data: [], hasMore: false }) },
  }),
);
