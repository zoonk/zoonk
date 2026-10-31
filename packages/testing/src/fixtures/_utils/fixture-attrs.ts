import { randomUUID } from "node:crypto";

/** Prisma's JSON read type includes null, an invalid write value, so JSON columns take objects. */
export type FixtureAttrs<TModel, TJson extends keyof TModel = never> = Partial<
  Omit<TModel, TJson>
> &
  Partial<Record<TJson, object>>;

/** A unique run id per row keeps tests that filter by run independent. */
export function fixtureProvenance() {
  return {
    model: "test/fixture-model",
    promptVersion: "test-v1",
    runId: `test-run-${randomUUID()}`,
  };
}
