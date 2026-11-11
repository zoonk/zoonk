import { withApiErrorBoundary } from "@/lib/api-handler";
import { countStaffRecords } from "@zoonk/core/staff/records";
import { staffResponse } from "../../_utils/response";

export const POST = withApiErrorBoundary(async (request: Request) =>
  staffResponse(await countStaffRecords(() => request.json())),
);
