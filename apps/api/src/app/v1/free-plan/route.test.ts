import { freePlanResponseSchema } from "@/lib/openapi/schemas/subscriptions";
import { getFreePlanLimits } from "@zoonk/core/entitlements/plan-limits";
import { describe, expect, it } from "vitest";
import { GET as getFreePlan } from "./route";

describe("GET /v1/free-plan", () => {
  it("answers the limits main's pricing shows, in the documented shape", async () => {
    const response = await getFreePlan();
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(freePlanResponseSchema.strict().parse(body)).toStrictEqual(getFreePlanLimits());
  });
});
