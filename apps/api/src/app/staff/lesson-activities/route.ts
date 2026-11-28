import { withApiErrorBoundary } from "@/lib/api-handler";
import { draftStaffLessonActivities } from "@zoonk/core/staff/lesson-activities";
import { staffResponse } from "../_utils/response";

export const maxDuration = 300;

export const POST = withApiErrorBoundary(async (request: Request) =>
  staffResponse(await draftStaffLessonActivities({ input: () => request.json() })),
);
