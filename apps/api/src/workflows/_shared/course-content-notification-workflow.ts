import { notifyCourseContentStep } from "./course-content-notification-step";

export async function courseContentNotificationWorkflow(tags: string[]): Promise<void> {
  "use workflow";

  await notifyCourseContentStep(tags);
}
