import { setupWorkflowTests, teardownWorkflowTests } from "@workflow/vitest";
import { zoonkDefaultProvider } from "@zoonk/ai/gateway";
import { afterAll, vi } from "vitest";

// Steps run outside a request: Next.js' request-bound helpers have nothing to act on here.
vi.mock("next/cache", () => ({
  cacheTag: vi.fn(),
  io: async () => null,
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
}));

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  after: vi.fn(),
}));

// Workflow tests bypass Next's instrumentation, which installs the test-disabled gateway.
globalThis.AI_SDK_DEFAULT_PROVIDER = zoonkDefaultProvider;

await setupWorkflowTests({ cwd: import.meta.dirname });

afterAll(async () => {
  await teardownWorkflowTests();
});
