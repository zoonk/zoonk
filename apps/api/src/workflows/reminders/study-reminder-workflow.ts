import {
  claimStudyReminderStep,
  sendStudyReminderEmailStep,
  sendStudyReminderPushStep,
} from "./steps/study-reminder-steps";

function readSettled<T>(result: PromiseSettledResult<T>): T | "failed" {
  return result.status === "fulfilled" ? result.value : "failed";
}

/** One learner's reminder for today: claim the day once, then email and push each on their own. */
export async function studyReminderWorkflow({ userId }: { userId: string }) {
  "use workflow";

  const claim = await claimStudyReminderStep(userId);

  if (claim !== "claimed") {
    return { claim };
  }

  const [email, push] = await Promise.allSettled([
    sendStudyReminderEmailStep(userId),
    sendStudyReminderPushStep(userId),
  ]);

  return { claim, email: readSettled(email), push: readSettled(push) };
}
