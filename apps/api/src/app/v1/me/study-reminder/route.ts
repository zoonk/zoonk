import { accessErrorCodes } from "@/lib/access-error-codes";
import { createErrorResponse, errors, httpStatus } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { readBody } from "@/lib/request-input";
import { studyReminderUpdateSchema } from "@zoonk/core/reminders/contract";
import { getStudyReminder } from "@zoonk/core/reminders/get";
import { type StudyReminderUpdateResult, updateStudyReminder } from "@zoonk/core/reminders/update";
import { type NextRequest, NextResponse } from "next/server";

async function getReminder() {
  const reminder = await getStudyReminder();

  if (!reminder) {
    return errors.unauthorized();
  }

  return NextResponse.json({ reminder });
}

function getUpdateErrorResponse(status: Exclude<StudyReminderUpdateResult["status"], "updated">) {
  if (status === "unauthorized") {
    return errors.unauthorized();
  }

  if (status === "timeNotOnQuarterHour") {
    return createErrorResponse({
      code: accessErrorCodes.timeNotOnQuarterHour,
      message: "Reminder times must be on a quarter hour (:00, :15, :30 or :45)",
      status: httpStatus.unprocessableEntity,
    });
  }

  if (status === "accountRequired") {
    return createErrorResponse({
      code: accessErrorCodes.accountRequired,
      message: "Email reminders need an account",
      status: httpStatus.unprocessableEntity,
    });
  }

  return createErrorResponse({
    code: accessErrorCodes.phoneRequired,
    message: "Push reminders need a selected phone",
    status: httpStatus.unprocessableEntity,
  });
}

async function updateReminder(request: NextRequest) {
  const input = await readBody(request, studyReminderUpdateSchema);
  const result = await updateStudyReminder(input);

  if (result.status !== "updated") {
    return getUpdateErrorResponse(result.status);
  }

  return NextResponse.json({ reminder: result.reminder });
}

export const GET = withApiErrorBoundary(getReminder);
export const PATCH = withApiErrorBoundary(updateReminder);
