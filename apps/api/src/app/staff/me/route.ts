import { withApiErrorBoundary } from "@/lib/api-handler";
import { getStaffMe } from "@zoonk/core/staff/me";
import { staffResponse } from "../_utils/response";

export const GET = withApiErrorBoundary(async () => staffResponse(await getStaffMe()));
