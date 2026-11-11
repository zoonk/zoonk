import { withApiErrorBoundary } from "@/lib/api-handler";
import { listStaffRecords } from "@zoonk/core/staff/records";
import { staffResponse } from "../../_utils/response";

export const POST = withApiErrorBoundary(async (request: Request) =>
  staffResponse(await listStaffRecords(() => request.json())),
);
