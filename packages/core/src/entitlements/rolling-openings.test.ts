import { UsageKind } from "@zoonk/db";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { toAllowance } from "./_utils/allowance-view";
import { evaluateUsage } from "./_utils/evaluate-usage";
import { type UsageTotals, getUsageCounts } from "./_utils/usage-counts";
import { type BundleClaim, type UsageLedger, decideBundle } from "./_utils/usage-ledger";
import { USAGE_WINDOW_MS, getCallMonthlyBudgetMicros, getUsageRule } from "./limits";

const NOW = new Date("2026-12-01T12:00:00Z");
const DAY = 86_400_000;
type Row = { at: Date; kind: UsageKind; seconds: number; cost: number };

function totalsAt(
  rows: readonly Row[],
  money: readonly { at: Date; amount: number }[],
  now: Date,
  activeGoals = 0,
): UsageTotals {
  const day = new Date(now);
  day.setUTCHours(0, 0, 0, 0);
  const inWindow = rows.filter((row) => row.at.getTime() > now.getTime() - USAGE_WINDOW_MS);
  const lessons = inWindow.filter((row) => row.kind === "lessonStart");

  return {
    activeGoals,
    callSpend: money
      .filter((row) => row.at.getTime() > now.getTime() - USAGE_WINDOW_MS)
      .toSorted((a, b) => b.at.getTime() - a.at.getTime()),
    kinds: new Map(
      [...Map.groupBy(rows, (row) => row.kind)].map(([kind, all]) => {
        const recent = inWindow
          .filter((row) => row.kind === kind)
          .toSorted((a, b) => b.at.getTime() - a.at.getTime());

        const today = all.filter((row) => row.at >= day);

        return [
          kind,
          {
            day: today.length,
            generatedTotal: 0,
            lastUsedAt: all.toSorted((a, b) => b.at.getTime() - a.at.getTime())[0]?.at ?? null,
            rollingClaims: recent.map((row) => ({
              amount: kind === "conversation" ? row.seconds : 1,
              at: row.at,
            })),
            secondsLast30Days: recent.reduce((sum, row) => sum + row.seconds, 0),
            secondsToday: today.reduce((sum, row) => sum + row.seconds, 0),
            total: all.length,
            usedLast30Days: recent.length,
          },
        ];
      }),
    ),
    lessonStarts: {
      count: lessons.length,
      latest: lessons
        .map((row) => row.at)
        .toSorted((a, b) => b.getTime() - a.getTime())
        .slice(0, 20),
      latestPrepared: [],
      prepared: 0,
    },
    spentTodayMicros: rows.filter((row) => row.at >= day).reduce((sum, row) => sum + row.cost, 0),
  };
}

function ledgerAt(rows: readonly Row[], now: Date, tier: "free" | "plus" = "free"): UsageLedger {
  return {
    claimed: new Set(),
    now,
    prepared: new Map(),
    totals: totalsAt(rows, [], now),
    viewer: { isGuest: false, tier, userId: "learner" },
  };
}

const age = fc.integer({ max: 35 * DAY, min: 0 });
const ages = fc.array(age, { maxLength: 35, minLength: 0 });

function usageRow(kind: UsageKind, ageMs: number, seconds = 0): Row {
  return { at: new Date(NOW.getTime() - ageMs), cost: 0, kind, seconds };
}

function mapClaims(lessons: number): BundleClaim[] {
  return [
    { generated: true, kind: "mindMap", targetId: "map" },
    ...Array.from({ length: lessons }, (_, i) => ({
      generated: true,
      kind: "lessonStart" as const,
      targetId: `lesson-${i}`,
    })),
  ];
}

describe("rolling request openings", () => {
  it("admits a chapter at the date when both its map and all its lessons fit", () => {
    const rows = [
      ...Array.from({ length: 20 }, () => usageRow("lessonStart", 26 * DAY)),
      ...Array.from({ length: 10 }, () => usageRow("mindMap", 11 * DAY)),
    ];

    const claims = mapClaims(2);
    const first = decideBundle({ claims, ledger: ledgerAt(rows, NOW) }).decision;

    expect(first).toMatchObject({
      limit: { availableAt: new Date("2026-12-20T12:00:00Z"), resource: "mindMap" },
      status: "limitReached",
    });

    expect(
      decideBundle({ claims, ledger: ledgerAt(rows, new Date("2026-12-20T12:00:00Z")) }).decision,
    ).toStrictEqual({ status: "allowed" });
  });

  it.each([false, true])(
    "opens a Plus map at its first admitted instant with a prepared lesson: %s",
    (prepared) => {
      const now = new Date("2026-12-01T23:59:59Z");
      const mapAt = new Date(now.getTime() - USAGE_WINDOW_MS + 500);

      const rows = [
        ...Array.from({ length: 1200 }, () => ({
          at: mapAt,
          cost: 0,
          kind: "mindMap" as const,
          seconds: 0,
        })),
        ...Array.from({ length: 200 }, () => ({
          at: now,
          cost: 0,
          kind: "lessonStart" as const,
          seconds: 0,
        })),
      ];

      const claims = mapClaims(1);

      const availableAt = prepared
        ? new Date(now.getTime() + 500)
        : new Date("2026-12-02T00:00:00Z");

      const at = (instant: Date) => ({
        ...ledgerAt(rows, instant, "plus"),
        prepared: new Map(
          prepared ? [["lessonStart:lesson-0", new Date("2026-11-20T12:00:00Z")]] : [],
        ),
      });

      expect(decideBundle({ claims, ledger: at(now) }).decision).toMatchObject({
        limit: { availableAt },
        status: "limitReached",
      });

      expect(decideBundle({ claims, ledger: at(availableAt) }).decision).toStrictEqual({
        status: "allowed",
      });
    },
  );

  it("admits each random chapter request at its promised instant, and not one millisecond before", () => {
    fc.assert(
      fc.property(ages, ages, fc.integer({ max: 20, min: 1 }), (lessonAges, mapAges, size) => {
        const rows = [
          ...lessonAges.map((at) => usageRow("lessonStart", at)),
          ...mapAges.map((at) => usageRow("mindMap", at)),
        ];

        const claims = mapClaims(size);
        const first = decideBundle({ claims, ledger: ledgerAt(rows, NOW) }).decision;

        if (first.status !== "limitReached" || !first.limit.availableAt) {
          return;
        }

        const at = first.limit.availableAt;

        expect(decideBundle({ claims, ledger: ledgerAt(rows, at) }).decision).toStrictEqual({
          status: "allowed",
        });

        expect(
          decideBundle({ claims, ledger: ledgerAt(rows, new Date(at.getTime() - 1)) }).decision
            .status,
        ).not.toBe("allowed");
      }),
      { numRuns: 300 },
    );
  });

  it("admits random Plus chapters when all unprepared lessons clear fair use", () => {
    fc.assert(
      fc.property(
        fc.integer({ max: 210, min: 190 }),
        fc.integer({ max: 20, min: 1 }),
        fc.integer({ max: 20, min: 0 }),
        fc.integer({ max: 2000, min: 1 }),
        (started, size, preparedCount, delay) => {
          const now = new Date("2026-12-01T23:59:59Z");

          const rows = [
            ...Array.from({ length: 1200 }, () => ({
              at: new Date(now.getTime() - USAGE_WINDOW_MS + delay),
              cost: 0,
              kind: "mindMap" as const,
              seconds: 0,
            })),
            ...Array.from({ length: started }, () => ({
              at: new Date(now.getTime() - 10_000),
              cost: 0,
              kind: "lessonStart" as const,
              seconds: 0,
            })),
          ];

          const claims = mapClaims(size);

          const at = (instant: Date) => ({
            ...ledgerAt(rows, instant, "plus"),
            prepared: new Map(
              Array.from({ length: Math.min(size, preparedCount) }, (_, i) => [
                `lessonStart:lesson-${i}`,
                new Date("2026-11-20T12:00:00Z"),
              ]),
            ),
          });

          const first = decideBundle({ claims, ledger: at(now) }).decision;

          if (first.status !== "limitReached" || !first.limit.availableAt) {
            throw new Error("Expected a timed map cap.");
          }

          const opening = first.limit.availableAt;

          expect(decideBundle({ claims, ledger: at(opening) }).decision).toStrictEqual({
            status: "allowed",
          });

          expect(
            decideBundle({ claims, ledger: at(new Date(opening.getTime() - 1)) }).decision.status,
          ).not.toBe("allowed");
        },
      ),
      { numRuns: 200 },
    );
  });

  it("gives calls the same earliest date in allowance and refusal for random seconds and money histories", () => {
    const seconds = fc.array(fc.record({ age, amount: fc.integer({ max: 600, min: 1 }) }), {
      maxLength: 30,
    });

    const money = fc.array(
      fc.record({ age, amount: fc.integer({ max: getCallMonthlyBudgetMicros("plus"), min: 1 }) }),
      { maxLength: 20 },
    );

    fc.assert(
      fc.property(
        seconds,
        money,
        fc.integer({ max: 1800, min: 1 }),
        fc.constantFrom("free" as const, "plus" as const),
        (uses, spends, requested, tier) => {
          const rows = uses.map((use) => usageRow("conversation", use.age, use.amount));

          const costs = spends.map((use) => ({
            amount: use.amount,
            at: new Date(NOW.getTime() - use.age),
          }));

          const decide = (at: Date) =>
            evaluateUsage({
              costMicros: requested * 1000,
              counts: getUsageCounts(totalsAt(rows, costs, at), "conversation"),
              generated: false,
              kind: "conversation",
              now: at,
              tier,
            });

          const first = decide(NOW);

          if (first.status !== "limitReached") {
            return;
          }

          const at = first.limit.availableAt ?? new Date("2026-12-02T00:00:00Z");

          const allowance = toAllowance({
            now: NOW,
            tier,
            totals: totalsAt(rows, costs, NOW),
          }).items.find((item) => item.kind === "conversation");

          expect(at).toStrictEqual(allowance?.availableAt ?? new Date("2026-12-02T00:00:00Z"));
          expect(at).toBeInstanceOf(Date);

          if (!at) {
            throw new Error("A call opens when recorded time and money age out.");
          }

          expect(decide(at)).toStrictEqual({ status: "allowed" });
          expect(decide(new Date(at.getTime() - 1)).status).not.toBe("allowed");
        },
      ),
      { numRuns: 300 },
    );
  });

  it.each(
    Object.values(UsageKind).flatMap((kind) =>
      (["free", "guest", "plus"] as const).flatMap((tier) => {
        const rule = getUsageRule({ kind, tier });
        const day = kind === "conversation" ? rule.daySeconds : rule.day;

        return day !== undefined && rule.rolling30Days !== undefined
          ? [{ day, kind, rolling: rule.rolling30Days, tier }]
          : [];
      }),
    ),
  )("reports the later daily or rolling cap for $tier $kind", ({ kind, tier, day, rolling }) => {
    fc.assert(
      fc.property(
        fc.integer({ max: 2 * DAY, min: 1 }),
        fc.integer({ max: 5, min: 0 }),
        (delay, over) => {
          const now = NOW;
          const oldAt = new Date(now.getTime() - USAGE_WINDOW_MS + delay);

          const rows =
            kind === "conversation"
              ? [
                  usageRow(kind, 0, day),
                  { at: oldAt, cost: 0, kind, seconds: rolling - day + over },
                ]
              : [
                  ...Array.from({ length: day }, () => usageRow(kind, 0)),
                  ...Array.from({ length: rolling - day + over }, () => ({
                    at: oldAt,
                    cost: 0,
                    kind,
                    seconds: 0,
                  })),
                ];

          const decide = (at: Date) =>
            evaluateUsage({
              costMicros: 0,
              counts: getUsageCounts(totalsAt(rows, [], at), kind),
              generated: false,
              kind,
              now: at,
              tier,
            });

          const first = decide(now);
          const availableAt = new Date(now.getTime() + Math.max(delay, DAY / 2));

          expect(first).toMatchObject({
            limit: { availableAt, period: delay >= DAY / 2 ? "rolling30Days" : "day" },
            status: "limitReached",
          });

          expect(decide(availableAt)).toStrictEqual({ status: "allowed" });
          expect(decide(new Date(availableAt.getTime() - 1)).status).toBe("limitReached");
        },
      ),
      { numRuns: 100 },
    );
  });

  it("does not hide a later rolling call-money opening behind daily time for random histories", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("free" as const, "plus" as const),
        fc.integer({ max: 2 * DAY, min: 1 }),
        (tier, delay) => {
          const day = getUsageRule({ kind: "conversation", tier }).daySeconds ?? 0;
          const rows = [usageRow("conversation", 0, day)];

          const money = [
            {
              amount: getCallMonthlyBudgetMicros(tier),
              at: new Date(NOW.getTime() - USAGE_WINDOW_MS + delay),
            },
          ];

          const decide = (at: Date) =>
            evaluateUsage({
              costMicros: 0,
              counts: getUsageCounts(totalsAt(rows, money, at), "conversation"),
              generated: false,
              kind: "conversation",
              now: at,
              tier,
            });

          const availableAt = new Date(NOW.getTime() + Math.max(delay, DAY / 2));

          expect(decide(NOW)).toMatchObject({
            limit: {
              availableAt,
              period: delay >= DAY / 2 ? "rolling30Days" : "day",
              resource: delay >= DAY / 2 ? "aiSpend" : "callSeconds",
            },
            status: "limitReached",
          });

          expect(
            toAllowance({ now: NOW, tier, totals: totalsAt(rows, money, NOW) }).items.find(
              (item) => item.kind === "conversation",
            )?.availableAt,
          ).toStrictEqual(availableAt);

          expect(decide(availableAt)).toStrictEqual({ status: "allowed" });
          expect(decide(new Date(availableAt.getTime() - 1)).status).toBe("limitReached");
        },
      ),
      { numRuns: 300 },
    );
  });

  it("does not date a goal opening when followed goals still require learner action", () => {
    const kinds = [
      "goal",
      "explanation",
      "mindMap",
      "upload",
      "outline",
      "tutorMessage",
      "assist",
    ] as const;

    fc.assert(
      fc.property(
        fc.constantFrom(...kinds),
        age,
        fc.integer({ max: 3, min: 0 }),
        (kind, ageMs, activeGoals) => {
          const cap = getUsageRule({ kind, tier: "free" }).rolling30Days ?? 0;

          const rows = Array.from({ length: cap }, () =>
            usageRow(kind, Math.min(ageMs, USAGE_WINDOW_MS - 1)),
          );

          const decide = (at: Date) =>
            evaluateUsage({
              costMicros: 0,
              counts: getUsageCounts(totalsAt(rows, [], at, activeGoals), kind),
              generated: false,
              kind,
              now: at,
              tier: "free",
            });

          const first = decide(NOW);
          expect(first.status).toBe("limitReached");

          if (first.status !== "limitReached") {
            throw new Error("Expected the rolling cap.");
          }

          const at = first.limit.availableAt;
          const needsAction = kind === "goal" && activeGoals === 3;
          expect(at === null).toBe(needsAction);

          if (!at) {
            return;
          }

          expect(decide(at)).toStrictEqual({ status: "allowed" });
          expect(decide(new Date(at.getTime() - 1)).status).not.toBe("allowed");
        },
      ),
      { numRuns: 300 },
    );
  });
});
