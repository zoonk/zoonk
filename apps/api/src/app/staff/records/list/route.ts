import { withApiErrorBoundary } from "@/lib/api-handler";
import { readBody } from "@/lib/request-input";
import { staffListSchema } from "@zoonk/core/staff/input";
import { listStaffRecords } from "@zoonk/core/staff/records";
import { staffResponse } from "../../_utils/response";

export const POST = withApiErrorBoundary(async (request: Request) =>
  staffResponse(await listStaffRecords(await readBody(request, staffListSchema))),
);
