"use client";

import { AdminConfirmDialog } from "@/components/admin-confirm-dialog";
import { type Course } from "@zoonk/db";
import { Button } from "@zoonk/ui/components/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@zoonk/ui/components/field";
import { Input } from "@zoonk/ui/components/input";
import { updateCourseAction } from "./_actions/update-course";

export function CourseEditButton({ course }: { course: Pick<Course, "id" | "slug" | "title"> }) {
  return (
    <AdminConfirmDialog
      action={updateCourseAction}
      confirmLabel="Save changes"
      description="What learners see as the course's name, and its address."
      title="Edit this course"
      trigger={
        <Button size="sm" variant="outline">
          Edit
        </Button>
      }
    >
      <input name="id" type="hidden" value={course.id} />

      <FieldGroup>
        <Field>
          <FieldContent>
            <FieldLabel htmlFor="title">Title</FieldLabel>
            <Input defaultValue={course.title} id="title" name="title" required />
          </FieldContent>
        </Field>

        <Field>
          <FieldContent>
            <FieldLabel htmlFor="slug">Slug</FieldLabel>
            <Input
              autoCapitalize="none"
              autoCorrect="off"
              defaultValue={course.slug}
              id="slug"
              name="slug"
              required
              spellCheck={false}
            />
            <FieldDescription>Changing it breaks existing links to this course.</FieldDescription>
          </FieldContent>
        </Field>
      </FieldGroup>
    </AdminConfirmDialog>
  );
}
