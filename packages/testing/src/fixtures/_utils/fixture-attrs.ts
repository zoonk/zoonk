import { randomUUID } from "node:crypto";

/**
 * Attributes a v2 fixture accepts: any column can be overridden, and JSON columns take plain objects
 * because Prisma's read type for JSON (which includes null) is not a valid write value.
 */
export type FixtureAttrs<TModel, TJson extends keyof TModel = never> = Partial<
  Omit<TModel, TJson>
> &
  Partial<Record<TJson, object>>;

/**
 * Provenance every generated Library row stores. A unique run id per row keeps tests that filter by
 * run independent from each other.
 */
export function fixtureProvenance() {
  return {
    model: "test/fixture-model",
    promptVersion: "test-v1",
    runId: `test-run-${randomUUID()}`,
  };
}
