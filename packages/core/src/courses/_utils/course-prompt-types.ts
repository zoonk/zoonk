import { type CoursePromptGetPayload } from "@zoonk/db";

export type CoursePromptWithCourse = CoursePromptGetPayload<{ include: { course: true } }>;
