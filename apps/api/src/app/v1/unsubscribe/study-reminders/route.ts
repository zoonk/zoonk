import { createErrorResponse, httpStatus } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { studyReminderUnsubscribeQuerySchema } from "@/lib/openapi/schemas/study-reminder";
import { readQueryParams } from "@/lib/request-input";
import { getUnsubscribePageUrl } from "@/lib/study-reminder-links";
import { turnOffStudyReminderEmail } from "@zoonk/core/reminders/email-unsubscribe";
import { type NextRequest, NextResponse } from "next/server";

const PRIVATE_HEADERS = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

/** A mail app that opens the link in a browser gets Main's page, whose one button turns email off. */
function openUnsubscribePage(request: NextRequest) {
  const { token } = readQueryParams(request, studyReminderUnsubscribeQuerySchema);

  return NextResponse.redirect(getUnsubscribePageUrl({ token }), {
    headers: PRIVATE_HEADERS,
    status: httpStatus.seeOther,
  });
}

/** RFC 8058 one-click: the mailbox posts `List-Unsubscribe=One-Click`; the token is the authority. */
async function unsubscribe(request: NextRequest) {
  const { token } = readQueryParams(request, studyReminderUnsubscribeQuerySchema);
  const result = await turnOffStudyReminderEmail(token);

  if (result === "invalid") {
    return createErrorResponse({
      code: "INVALID_UNSUBSCRIBE_TOKEN",
      message: "This unsubscribe link isn't valid",
      status: httpStatus.badRequest,
    });
  }

  return NextResponse.json({ emailOn: false }, { headers: PRIVATE_HEADERS });
}

export const GET = withApiErrorBoundary(openUnsubscribePage);
export const POST = withApiErrorBoundary(unsubscribe);
