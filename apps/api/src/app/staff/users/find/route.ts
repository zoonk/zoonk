import { withApiErrorBoundary } from "@/lib/api-handler";
import { readBody } from "@/lib/request-input";
import { staffFindUserSchema } from "@zoonk/core/staff/input";
import { findStaffUser } from "@zoonk/core/staff/users";
import { staffResponse } from "../../_utils/response";

export const POST = withApiErrorBoundary(async (request: Request) =>
  staffResponse(await findStaffUser(await readBody(request, staffFindUserSchema))),
);
