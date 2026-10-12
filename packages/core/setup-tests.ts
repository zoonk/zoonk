import { afterAll, beforeAll, beforeEach, vi } from "vitest";
import { boundaries, resetBoundaries } from "./src/_test-utils/test-boundaries";

vi.mock("server-only", () => ({}));

// The edges every test replaces, declared once (see `src/_test-utils/test-boundaries.ts`).
vi.mock("next/cache", () =>
  import("./src/_test-utils/test-boundaries").then((testBoundaries) => testBoundaries.nextCache),
);

vi.mock("next/server", () =>
  import("./src/_test-utils/test-boundaries").then((testBoundaries) => testBoundaries.nextServer),
);

vi.mock("next/headers", () =>
  import("./src/_test-utils/test-boundaries").then((testBoundaries) => testBoundaries.nextHeaders),
);

vi.mock("./src/users/get-session", () =>
  import("./src/_test-utils/test-boundaries").then((testBoundaries) => testBoundaries.session),
);

vi.mock("./src/progress/get-request-date-context", () =>
  import("./src/_test-utils/test-boundaries").then((testBoundaries) => testBoundaries.dateContext),
);

vi.mock("./src/analytics/server", () =>
  import("./src/_test-utils/test-boundaries").then((testBoundaries) => testBoundaries.analytics),
);

Object.entries(boundaries).forEach(([path, mocks]) => {
  vi.doMock(path, async (importOriginal) => ({ ...(await importOriginal<object>()), ...mocks }));
});

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
