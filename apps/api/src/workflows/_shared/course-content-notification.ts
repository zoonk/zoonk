import { type CourseContentWrite } from "@zoonk/core/cache/course-content";
import { start } from "workflow/api";
import { courseContentNotificationWorkflow } from "./course-content-notification-workflow";

/** A saved write succeeds once its independent notification run is durable. */
export async function deliverCourseContent<T>(write: Promise<CourseContentWrite<T>>): Promise<T> {
  const { tags, value } = await write;

  if (tags.length > 0) {
    await start(courseContentNotificationWorkflow, [tags]);
  }

  return value;
}
