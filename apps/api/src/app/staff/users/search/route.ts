import { withApiErrorBoundary } from "@/lib/api-handler";
import { searchStaffUsers } from "@zoonk/core/staff/users";
import { staffResponse } from "../../_utils/response";

export const POST = withApiErrorBoundary(async (request: Request) =>
  staffResponse(await searchStaffUsers(() => request.json())),
);
