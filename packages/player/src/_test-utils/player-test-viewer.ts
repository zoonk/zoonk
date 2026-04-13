import { type PlayerViewer } from "../player-context";

/**
 * Shared browser tests should exercise the authenticated branch because that is
 * where completion persistence, rewards, and personalization are wired.
 */
export function buildAuthenticatedViewer(overrides: Partial<PlayerViewer> = {}): PlayerViewer {
  return {
    isAuthenticated: true,
    userName: "Alex",
    ...overrides,
  };
}
