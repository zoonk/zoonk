"use client";

import {
  AdminEditForm,
  AdminEditFormActions,
  AdminEditFormFeedback,
} from "@/components/admin-edit-form";
import { type Course } from "@zoonk/db";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@zoonk/ui/components/field";
import { Input } from "@zoonk/ui/components/input";
import { SubmitButton } from "@zoonk/ui/patterns/buttons/submit";
import { CheckIcon } from "lucide-react";
import { useActionState } from "react";
import { type UpdateCourseState, updateCourseAction } from "./_actions/update-course";

export function CourseForm({ course }: { course: Pick<Course, "id" | "slug" | "title"> }) {
  const [state, formAction] = useActionState(updateCourseAction, {
    error: null,
    slug: course.slug,
    status: "idle",
    submissionId: 0,
    title: course.title,
  } satisfies UpdateCourseState);

  return (
    <AdminEditForm action={formAction}>
      <input name="id" type="hidden" value={course.id} />

      <FieldGroup>
        <Field>
          <FieldContent>
            <FieldLabel htmlFor="title">Title</FieldLabel>
            <Input defaultValue={state.title} id="title" key={state.title} name="title" required />
            <FieldDescription>The learner-facing course title and search label.</FieldDescription>
          </FieldContent>
        </Field>

        <Field>
          <FieldContent>
            <FieldLabel htmlFor="slug">Slug</FieldLabel>
            <Input
              autoCapitalize="none"
              autoCorrect="off"
              defaultValue={state.slug}
              id="slug"
              key={state.slug}
              name="slug"
              required
              spellCheck={false}
            />
            <FieldDescription>
              Used in course URLs. New values are normalized to a URL-safe slug when saved.
            </FieldDescription>
          </FieldContent>
        </Field>
      </FieldGroup>

      <AdminEditFormActions>
        <SubmitButton icon={<CheckIcon />}>Save changes</SubmitButton>
        <AdminEditFormFeedback
          error={state.status === "error" ? state.error : null}
          submissionId={state.submissionId}
          successMessage={state.status === "success" ? "Course updated." : null}
        />
      </AdminEditFormActions>
    </AdminEditForm>
  );
}
