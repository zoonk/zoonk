import { type CefrLevel } from "@zoonk/utils/cefr";

/** C2 isn't placed by a three-minute test. */
export const LEVEL_TEST_LEVELS = [
  "A1",
  "A2",
  "B1",
  "B2",
  "C1",
] as const satisfies readonly CefrLevel[];

export type TestLevel = (typeof LEVEL_TEST_LEVELS)[number];
