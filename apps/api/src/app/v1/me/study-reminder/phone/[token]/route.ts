import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { studyReminderPhonePathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { removeStudyReminderPhone } from "@zoonk/core/reminders/phone";
import { type NextRequest, NextResponse } from "next/server";

type PhoneContext = RouteContext<"/v1/me/study-reminder/phone/[token]">;

async function removePhone(_request: NextRequest, context: PhoneContext) {
  const path = await readPathParams(context, studyReminderPhonePathParamsSchema);
  const result = await removeStudyReminderPhone(path.token);

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  return NextResponse.json({ reminder: result.reminder });
}

export const DELETE = withApiErrorBoundary(removePhone);
