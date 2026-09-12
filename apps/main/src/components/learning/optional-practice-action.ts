"use server";

import {
  type OptionalActivityKind,
  startLessonOptionalActivity,
} from "@zoonk/core/lessons/optional-activities";

/** The explicit action creates only a missing activity shell; generation keeps its normal access and allowance checks. */
export async function requestOptionalPractice({
  lessonId,
  kind,
}: {
  lessonId: string;
  kind: OptionalActivityKind;
}) {
  return startLessonOptionalActivity({ kind, lessonId });
}
