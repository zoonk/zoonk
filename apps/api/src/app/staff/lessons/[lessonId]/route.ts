import { withApiErrorBoundary } from "@/lib/api-handler";
import { getStaffLesson } from "@zoonk/core/staff/lesson";
import { staffResponse } from "../../_utils/response";

export const GET = withApiErrorBoundary(
  async (_request: Request, context: RouteContext<"/staff/lessons/[lessonId]">) =>
    staffResponse(await getStaffLesson(() => context.params)),
);
