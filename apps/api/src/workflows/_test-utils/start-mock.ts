import { vi } from "vitest";
import { start } from "workflow/api";

/**
 * `vi.mocked` types a mock by its last overload, which takes workflow source; instantiating `start`
 * keeps the overloads that take a workflow function.
 */
export function getStartMock() {
  return vi.mocked(start<unknown[], unknown>);
}
