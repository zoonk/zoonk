import { describe, expect, it } from "vitest";
import { getRefundLastDay } from "./subscription";

// 23:30 on October 1 in São Paulo is already October 2 in UTC.
const SUBSCRIBED_AT = new Date("2026-10-02T02:30:00Z");
const TIME_ZONE = "America/Sao_Paulo";

describe(getRefundLastDay, () => {
  it("is the 14th day after the purchase day where the learner subscribed", () => {
    expect(getRefundLastDay({ subscribedAt: SUBSCRIBED_AT, timeZone: TIME_ZONE })).toStrictEqual(
      new Date("2026-10-15T00:00:00Z"),
    );

    expect(getRefundLastDay({ subscribedAt: SUBSCRIBED_AT, timeZone: "UTC" })).toStrictEqual(
      new Date("2026-10-16T00:00:00Z"),
    );
  });
});
