import { vi } from "vitest";
import { start } from "workflow/api";

/**
 * The mocked `start`, typed by the call our workflows make: a workflow function and its arguments.
 * `vi.mocked` types a mock by its function's last overload, which starts a dynamic workflow from
 * source, so its calls would read as source strings; instantiating `start` keeps only the
 * overloads that take a workflow function.
 */
export function getStartMock() {
  return vi.mocked(start<unknown[], unknown>);
}
