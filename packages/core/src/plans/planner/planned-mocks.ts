import { type UnfundedMove } from "../plan-error-contract";
import { type FundedMocks, type MockFunding } from "./mock-funding";
import {
  type MockClock,
  type MockResolution,
  getMockCursor,
  listKeptPastFunding,
  resolveRetainedMocks,
} from "./mock-identity";
import { toIsoDate } from "./plan-calendar";
import { type PlannedItem } from "./plan-items";

export type PlannedMocks = {
  horizon: number;
  mockFunding: MockFunding[];
  next: MockResolution | null;
  unfundedMocks: UnfundedMove[];
};

export function settlePlannedMocks({
  afterExam,
  clocks = [],
  dayPass,
  items,
  resolution,
  saved,
  spare,
  today,
}: {
  afterExam: FundedMocks | null;
  clocks?: readonly MockClock[];
  dayPass: FundedMocks;
  items: readonly PlannedItem[];
  resolution: MockResolution | null;
  saved: readonly MockFunding[];
  spare: { funding: readonly MockFunding[]; sourced: ReadonlySet<string> };
  today: Date;
}): PlannedMocks {
  const start = toIsoDate(today);

  const held = new Set(
    items.flatMap((item) =>
      item.kind === "mock" && item.scheduledFor ? [toIsoDate(item.scheduledFor)] : [],
    ),
  );

  const funded = [...dayPass.funding, ...spare.funding, ...(afterExam?.funding ?? [])];
  const retained = funded.filter((entry) => held.has(entry.date));

  const next = resolveRetainedMocks({
    clocks,
    current: resolution,
    cursor: getMockCursor({ saved, start }),
    funded: [...dayPass.funding, ...(afterExam?.funding ?? [])].map((entry) => entry.date),
    held,
    retained: retained.flatMap((entry) =>
      entry.day === undefined || entry.fullLength === undefined
        ? []
        : [{ date: entry.date, day: entry.day, fullLength: entry.fullLength }],
    ),
    sourced: new Set([...dayPass.sourced, ...spare.sourced, ...(afterExam?.sourced ?? [])]),
  });

  const unfundedMocks = [...dayPass.unfunded, ...(afterExam?.unfunded ?? [])];

  return {
    horizon: funded.length + unfundedMocks.length,
    mockFunding: [...listKeptPastFunding({ saved, start }), ...retained].toSorted((a, b) =>
      a.date.localeCompare(b.date),
    ),
    next,
    unfundedMocks,
  };
}

const SETTLING_PASSES = 2;

/**
 * Throws when its mocks don't settle within `horizon` releases, rather than save time set aside for
 * mocks it doesn't hold.
 */
export function resolvePlannedMocks<T extends { mocks: PlannedMocks }>(
  plan: (resolution: MockResolution | null) => T,
): T {
  let built = plan(null);
  const limit = built.mocks.horizon + SETTLING_PASSES;

  for (let pass = 1; built.mocks.next; pass += 1) {
    if (pass > limit) {
      throw new Error(`The plan's mocks didn't settle in ${limit} passes.`);
    }

    built = plan(built.mocks.next);
  }

  return built;
}
