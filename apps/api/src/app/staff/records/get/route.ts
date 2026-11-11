import { withApiErrorBoundary } from "@/lib/api-handler";
import { readBody } from "@/lib/request-input";
import { staffGetSchema } from "@zoonk/core/staff/input";
import { getStaffRecord } from "@zoonk/core/staff/records";
import { staffResponse } from "../../_utils/response";

export const POST = withApiErrorBoundary(async (request: Request) =>
  staffResponse(await getStaffRecord(await readBody(request, staffGetSchema))),
);
