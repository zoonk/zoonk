import { withApiErrorBoundary } from "@/lib/api-handler";
import { readBody } from "@/lib/request-input";
import { staffSearchUsersSchema } from "@zoonk/core/staff/input";
import { searchStaffUsers } from "@zoonk/core/staff/users";
import { staffResponse } from "../../_utils/response";

export const POST = withApiErrorBoundary(async (request: Request) =>
  staffResponse(await searchStaffUsers(await readBody(request, staffSearchUsersSchema))),
);
