import { withApiErrorBoundary } from "@/lib/api-handler";
import { draftStaffLanguageActivities } from "@zoonk/core/staff/language-activities";
import { staffResponse } from "../_utils/response";

export const maxDuration = 300;

export const POST = withApiErrorBoundary(async (request: Request) =>
  staffResponse(await draftStaffLanguageActivities({ input: () => request.json() })),
);
