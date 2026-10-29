import { type CourseLevel } from "@zoonk/db/enums";

export type CourseProgress = { lessonStarted: boolean; level: CourseLevel | null };
