import { afterAll, beforeAll, beforeEach, vi } from "vitest";
import { resetBoundaries } from "./src/_test-utils/test-boundaries";

vi.mock("server-only", () => ({}));

// The edges every test replaces, declared once (see `src/_test-utils/test-boundaries.ts`).
vi.mock("next/cache", () =>
  import("./src/_test-utils/test-boundaries").then((boundaries) => boundaries.nextCache),
);

vi.mock("next/server", () =>
  import("./src/_test-utils/test-boundaries").then((boundaries) => boundaries.nextServer),
);

vi.mock("next/headers", () =>
  import("./src/_test-utils/test-boundaries").then((boundaries) => boundaries.nextHeaders),
);

vi.mock("./src/users/get-session", () =>
  import("./src/_test-utils/test-boundaries").then((boundaries) => boundaries.session),
);

vi.mock("./src/progress/get-request-date-context", () =>
  import("./src/_test-utils/test-boundaries").then((boundaries) => boundaries.dateContext),
);

vi.mock("./src/analytics/server", () =>
  import("./src/_test-utils/test-boundaries").then((boundaries) => boundaries.analytics),
);

// Test files share workers: each starts as a fresh one would, and leaves no fake clock, stubbed
// global or spy (the simulator's database tier spies on core's reads) behind for the next.
beforeAll(async () => {
  await resetBoundaries();
});

beforeEach(() => {
  vi.clearAllMocks();
});

afterAll(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
