import { withApiErrorBoundary } from "@/lib/api-handler";
import { getStaffModels } from "@zoonk/core/staff/models";
import { staffResponse } from "../_utils/response";

export const GET = withApiErrorBoundary(async () => staffResponse(await getStaffModels()));
