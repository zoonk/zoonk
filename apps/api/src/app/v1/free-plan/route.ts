import { withApiErrorBoundary } from "@/lib/api-handler";
import { getFreePlanLimits } from "@zoonk/core/entitlements/plan-limits";
import { NextResponse } from "next/server";

function getFreePlan() {
  return NextResponse.json(getFreePlanLimits());
}

export const GET = withApiErrorBoundary(getFreePlan);
