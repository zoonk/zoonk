import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { readBody } from "@/lib/request-input";
import { studyReminderPhoneSchema } from "@zoonk/core/reminders/contract";
import { selectStudyReminderPhone } from "@zoonk/core/reminders/phone";
import { type NextRequest, NextResponse } from "next/server";

async function selectPhone(request: NextRequest) {
  const input = await readBody(request, studyReminderPhoneSchema);
  const result = await selectStudyReminderPhone(input);

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  return NextResponse.json({ reminder: result.reminder });
}

export const PUT = withApiErrorBoundary(selectPhone);
