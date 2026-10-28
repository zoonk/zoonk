import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { getAllowance } from "@zoonk/core/entitlements/get-allowance";
import { NextResponse } from "next/server";

async function getCurrentUserAllowance() {
  const allowance = await getAllowance();

  if (!allowance) {
    return errors.unauthorized();
  }

  return NextResponse.json({
    ...allowance,
    resets: {
      day: allowance.resets.day.toISOString(),
      month: allowance.resets.month.toISOString(),
    },
  });
}

export const GET = withApiErrorBoundary(getCurrentUserAllowance);
