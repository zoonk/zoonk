import { withApiErrorBoundary } from "@/lib/api-handler";
import { proposeContentFix } from "@zoonk/core/staff/content-fixes/propose";
import { proposalResponse } from "./_utils/response";

export const POST = withApiErrorBoundary(async (request: Request) =>
  proposalResponse(await proposeContentFix(() => request.json())),
);
