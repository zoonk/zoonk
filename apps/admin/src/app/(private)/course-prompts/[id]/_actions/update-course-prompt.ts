"use server";

import { assertAdmin } from "@/lib/admin-guard";
import { getCoursePromptGenerationError } from "@zoonk/core/courses/prompt-generation";
import { CourseFormat, type CoursePrompt, CoursePromptIntent, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { parseFormField } from "@zoonk/utils/form";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidatePath } from "next/cache";

export type UpdateCoursePromptState = {
  canEditGenerationStatus: boolean;
  canonicalTitle: string;
  courseFormat: CoursePrompt["courseFormat"];
  error: string | null;
  generationStatus: CoursePrompt["generationStatus"];
  intent: CoursePrompt["intent"];
  status: "idle" | "error" | "success";
  submissionId: number;
};

type CoursePromptFormValues = {
  canonicalTitle: string | null;
  courseFormat: CoursePrompt["courseFormat"];
  id: string;
  intent: CoursePrompt["intent"];
  requestedStatus: string | null;
};

/**
 * Runtime enum validation prevents a handcrafted Server Action request from
 * storing a classification value that was never offered by the edit form.
 */
function isCoursePromptIntent(value: string | null): value is CoursePrompt["intent"] {
  return Boolean(value && Object.values(CoursePromptIntent).some((intent) => intent === value));
}

/**
 * Optional course formats use an empty form value for null, while non-empty
 * values must still be one of the database enum members.
 */
function isCourseFormat(value: string): value is NonNullable<CoursePrompt["courseFormat"]> {
  return Object.values(CourseFormat).some((format) => format === value);
}

/**
 * Converts the form's empty option to the database null value and leaves an
 * invalid enum distinguishable from that intentional absence.
 */
function parseCourseFormat(value: string): CoursePrompt["courseFormat"] | undefined {
  if (value === "") {
    return null;
  }

  if (isCourseFormat(value)) {
    return value;
  }
}

/**
 * Parses and validates the complete untrusted form payload before the action
 * reads a prompt or starts constructing database update values.
 */
function parseCoursePromptFormValues(
  formData: FormData,
): { data: CoursePromptFormValues; error: null } | { data: null; error: string } {
  const id = parseFormField(formData, "id");
  const intent = parseFormField(formData, "intent");
  const courseFormatValue = parseFormField(formData, "courseFormat");
  const canonicalTitle = parseFormField(formData, "canonicalTitle") || null;
  const requestedStatus = parseFormField(formData, "generationStatus");

  if (!(isUuid(id) && isCoursePromptIntent(intent) && courseFormatValue !== null)) {
    return { data: null, error: "Invalid course prompt fields." };
  }

  const courseFormat = parseCourseFormat(courseFormatValue);

  if (courseFormat === undefined) {
    return { data: null, error: "Invalid course format." };
  }

  if (requestedStatus !== null && requestedStatus !== "" && requestedStatus !== "pending") {
    return { data: null, error: "Invalid generation status." };
  }

  return { data: { canonicalTitle, courseFormat, id, intent, requestedStatus }, error: null };
}

/**
 * Admins may start generation only from the explicit "No generation" state.
 * Existing workflow states belong to the workflow and cannot be reset here.
 */
function getGenerationStatus({
  currentStatus,
  requestedStatus,
}: {
  currentStatus: CoursePrompt["generationStatus"];
  requestedStatus: string | null;
}): CoursePrompt["generationStatus"] | undefined {
  if (requestedStatus === null || requestedStatus === "") {
    return currentStatus;
  }

  if (requestedStatus === "pending" && currentStatus === null) {
    return "pending";
  }
}

/**
 * Failed submissions keep the values the admin just chose. A pending request
 * remains editable when the stored prompt still has no workflow-owned status.
 */
function getSubmittedCoursePromptState({
  currentStatus,
  values,
}: {
  currentStatus: CoursePrompt["generationStatus"];
  values: CoursePromptFormValues;
}): Omit<UpdateCoursePromptState, "error" | "status" | "submissionId"> {
  const generationStatus =
    currentStatus === null && values.requestedStatus === "pending" ? "pending" : currentStatus;

  return {
    canEditGenerationStatus: currentStatus === null,
    canonicalTitle: values.canonicalTitle ?? "",
    courseFormat: values.courseFormat,
    generationStatus,
    intent: values.intent,
  };
}

/**
 * Updates the editable routing decision after re-authorizing and validating
 * every submitted field. Successful saves return the persisted values so the
 * form can confirm the change without navigating away or showing stale defaults.
 */
export async function updateCoursePromptAction(
  previousState: UpdateCoursePromptState,
  formData: FormData,
): Promise<UpdateCoursePromptState> {
  await assertAdmin();

  const submissionId = previousState.submissionId + 1;
  const parsedValues = parseCoursePromptFormValues(formData);

  if (!parsedValues.data) {
    return { ...previousState, error: parsedValues.error, status: "error", submissionId };
  }

  const values = parsedValues.data;
  const { canonicalTitle, courseFormat, id, intent, requestedStatus } = values;

  const { data: prompt, error: readError } = await safeAsync(() =>
    prisma.coursePrompt.findUnique({ where: { id } }),
  );

  if (readError) {
    return {
      ...previousState,
      error: "Could not load this course prompt. Please try again.",
      status: "error",
      submissionId,
    };
  }

  if (!prompt) {
    return { ...previousState, error: "Course prompt not found.", status: "error", submissionId };
  }

  const submittedState = getSubmittedCoursePromptState({
    currentStatus: prompt.generationStatus,
    values,
  });

  const generationStatus = getGenerationStatus({
    currentStatus: prompt.generationStatus,
    requestedStatus,
  });

  if (generationStatus === undefined) {
    return {
      ...submittedState,
      error: "Only prompts with no generation can be moved to pending.",
      status: "error",
      submissionId,
    };
  }

  const updatedPrompt = { ...prompt, canonicalTitle, courseFormat, generationStatus, intent };

  if (requestedStatus === "pending") {
    const generationError = getCoursePromptGenerationError(updatedPrompt);

    if (generationError) {
      return { ...submittedState, error: generationError, status: "error", submissionId };
    }
  }

  const { error: updateError } = await safeAsync(() =>
    prisma.coursePrompt.update({
      data: { canonicalTitle, courseFormat, generationStatus, intent },
      where: { id },
    }),
  );

  if (updateError) {
    return {
      ...submittedState,
      error: "Could not save this course prompt. Please try again.",
      status: "error",
      submissionId,
    };
  }

  revalidatePath("/course-prompts");
  revalidatePath(`/course-prompts/${id}`);

  return {
    ...submittedState,
    canEditGenerationStatus: generationStatus === null,
    error: null,
    generationStatus,
    status: "success",
    submissionId,
  };
}
