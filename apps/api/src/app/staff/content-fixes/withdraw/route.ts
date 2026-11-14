import { withApiErrorBoundary } from "@/lib/api-handler";
import { withdrawContentFixes } from "@zoonk/core/staff/content-fixes/withdraw";
import { withdrawalResponse } from "../_utils/response";

export const POST = withApiErrorBoundary(async (request: Request) =>
  withdrawalResponse(await withdrawContentFixes(() => request.json())),
);
