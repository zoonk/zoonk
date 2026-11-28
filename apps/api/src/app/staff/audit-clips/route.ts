import { withApiErrorBoundary } from "@/lib/api-handler";
import { auditStoredClips } from "@zoonk/core/staff/audit-clips";
import { staffResponse } from "../_utils/response";

export const maxDuration = 300;

export const POST = withApiErrorBoundary(async (request: Request) =>
  staffResponse(await auditStoredClips({ input: () => request.json(), signal: request.signal })),
);
