import { withApiErrorBoundary } from "@/lib/api-handler";
import { readBody } from "@/lib/request-input";
import { staffCountSchema } from "@zoonk/core/staff/input";
import { countStaffRecords } from "@zoonk/core/staff/records";
import { staffResponse } from "../../_utils/response";

export const POST = withApiErrorBoundary(async (request: Request) =>
  staffResponse(await countStaffRecords(await readBody(request, staffCountSchema))),
);
