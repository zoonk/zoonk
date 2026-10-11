import { vi } from "vitest";
import { type getRequestProgressDateContext } from "../progress/get-request-date-context";

/**
 * What every core test replaces at the edge of the code under test (see `setup-tests.ts`): Next.js'
 * request APIs, which have no request here, the signed-in learner (`mockSession`), the request's
 * date (the real one unless a test sets it) and analytics, which never leaves a test. Test files
 * share workers, so a worker keeps one set of these functions for every file it runs, and each file
 * starts with them as a fresh worker would (`resetBoundaries`).
 */
export const nextCache = {
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  // Outside a request, Next.js' `io()` resolves at once, as it does here.
  io: async () => null,
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
};

// Tests run outside a request, where Next.js' `after` throws and `connection` has no request to wait
// for. Tests that check deferred work run it with `runDeferredWork` from `deferred-work.ts`.
export const nextServer = { after: vi.fn(), connection: vi.fn() };

export const nextHeaders = { headers: vi.fn() };

export const session = { getSession: vi.fn() };

export const dateContext = { getRequestProgressDateContext: vi.fn() };

export const analytics = { trackServerEvent: vi.fn() };

/** Puts every boundary back as a fresh worker has it, before a test file runs. */
export async function resetBoundaries(): Promise<void> {
  const actualDateContext = await vi.importActual<{
    getRequestProgressDateContext: typeof getRequestProgressDateContext;
  }>("../progress/get-request-date-context");

  [
    ...Object.values(nextCache),
    ...Object.values(nextServer),
    nextHeaders.headers,
    session.getSession,
    dateContext.getRequestProgressDateContext,
    analytics.trackServerEvent,
  ].forEach((fn) => {
    if (vi.isMockFunction(fn)) {
      fn.mockReset();
    }
  });

  nextServer.connection.mockResolvedValue(null);
  nextHeaders.headers.mockImplementation(async () => new Headers());

  dateContext.getRequestProgressDateContext.mockImplementation(
    actualDateContext.getRequestProgressDateContext,
  );
}
