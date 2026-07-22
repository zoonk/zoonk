"use client";

import {
  AdminEditForm,
  AdminEditFormActions,
  AdminEditFormFeedback,
} from "@/components/admin-edit-form";
import { type Course } from "@zoonk/db";
import { buttonVariants } from "@zoonk/ui/components/button";
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
import Link from "next/link";
import { useActionState } from "react";
import { type UpdateCourseState, updateCourseAction } from "./_actions/update-course";

/**
 * Course identity editing keeps title and slug together because the title is
 * searchable while the slug is the public URL identity admins need to verify.
 */
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

      <AdminEditFormFeedback
        error={state.status === "error" ? state.error : null}
        submissionId={state.submissionId}
        successMessage={state.status === "success" ? "Course updated successfully." : null}
      />

      <AdminEditFormActions>
        <Link className={buttonVariants({ variant: "outline" })} href="/courses">
          Cancel
        </Link>
        <SubmitButton icon={<CheckIcon />}>Save changes</SubmitButton>
      </AdminEditFormActions>
    </AdminEditForm>
  );
}
