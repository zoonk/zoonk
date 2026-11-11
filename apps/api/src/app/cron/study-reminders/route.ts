import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { studyReminderWorkflow } from "@/workflows/reminders/study-reminder-workflow";
import { listDueStudyReminders } from "@zoonk/core/reminders/send";
import { NextResponse } from "next/server";
import { start } from "workflow/api";

const ACCEPTED = 202;

/**
 * Only Vercel's scheduler can call this: its schedule trigger in `vercel.json` gives it no public
 * URL. Each due learner gets a workflow; the claim inside it makes a second start harmless.
 */
async function startStudyReminders(request: Request) {
  if (!request.headers.get("ce-id")) {
    return errors.badRequest("Not a scheduled run");
  }

  const userIds = await listDueStudyReminders(new Date());

  await Promise.all(userIds.map((userId) => start(studyReminderWorkflow, [{ userId }])));

  return NextResponse.json({ started: userIds.length }, { status: ACCEPTED });
}

export const POST = withApiErrorBoundary(startStudyReminders);
