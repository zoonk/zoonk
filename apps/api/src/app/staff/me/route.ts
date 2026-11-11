import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { getStaffMe } from "@zoonk/core/staff/me";
import { NextResponse } from "next/server";

async function getCurrentStaffMember() {
  const me = await getStaffMe();

  if (me.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (me.status === "forbidden") {
    return errors.forbidden();
  }

  return NextResponse.json({ user: me.user });
}

export const GET = withApiErrorBoundary(getCurrentStaffMember);
