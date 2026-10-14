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
import { type MovedEvent } from "./plan-state";

/** What a planning pass settled about its mocks (see `settlePlannedMocks`). */
export type PlannedMocks = {
  /** How many mocks the pass considered, funded or not: what bounds the passes that settle them. */
  horizon: number;
  /** The funding the plan saves: its retained mocks', and the past days a page still shows. */
  mockFunding: MockFunding[];
  /** The resolution to plan again with, or null when this pass's mocks hold. */
  next: MockResolution | null;
  /** The mocks the plan keeps on another day than their own (see `findRelocation`). */
  relocations: MovedEvent[];
  /** The mocks the days before them can't fund, at their real length: not in the plan. */
  unfundedMocks: UnfundedMove[];
};

/**
 * A pass's mocks, reconciled with what the plan keeps: the plan saves funding only for the mocks it
 * holds (its items), so no day sets time aside for one it doesn't, and the funded mocks it left out
 * give their days back on the next pass (see `resolveRetainedMocks`), as do new mocks whose exam
 * day the final order changes. A spare mock and a mock after the exam take their turn like any.
 */
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
    relocations: [...dayPass.relocations, ...(afterExam?.relocations ?? [])].filter((relocation) =>
      held.has(relocation.to),
    ),
    unfundedMocks,
  };
}

/** Passes beyond the horizon's releases: one to settle the identities, one to see them hold. */
const SETTLING_PASSES = 2;

/**
 * Plans until its mocks hold (see `settlePlannedMocks`): every retained mock has the exam day its
 * order gives it, and every mock the plan funds is one it holds, so the funding it saves is all the
 * time its days set aside. A pass that doesn't hold releases more of the first pass's mocks (never
 * more than it considered, `horizon`) or names them anew, which the next pass, with the same mocks,
 * keeps; past that bound the plan is refused rather than saved with time set aside for mocks it
 * doesn't hold.
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
