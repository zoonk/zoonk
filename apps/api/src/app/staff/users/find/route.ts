import { withApiErrorBoundary } from "@/lib/api-handler";
import { findStaffUser } from "@zoonk/core/staff/users";
import { staffResponse } from "../../_utils/response";

export const POST = withApiErrorBoundary(async (request: Request) =>
  staffResponse(await findStaffUser(() => request.json())),
);
