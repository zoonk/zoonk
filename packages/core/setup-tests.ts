import { afterAll, beforeAll, beforeEach, vi } from "vitest";
import { boundaries, resetBoundaries } from "./src/_test-utils/test-boundaries";

// Shared workers keep their pools between files; label connections before the first one opens.
process.env.PGAPPNAME = `zoonk-core-test:${process.pid}:${process.env.VITEST_POOL_ID ?? "main"}`;

vi.mock("server-only", () => ({}));

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

// Test files share workers, so reset their boundaries and restore their globals between files.
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
