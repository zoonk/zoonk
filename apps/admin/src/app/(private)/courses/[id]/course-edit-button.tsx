"use client";

import { type AdminActionState, useAdminActionState } from "@/lib/use-admin-action-state";
import { type Course } from "@zoonk/db";
import { Button } from "@zoonk/ui/components/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@zoonk/ui/components/drawer";
import { EnterButton } from "@zoonk/ui/components/enter-button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@zoonk/ui/components/field";
import { Input } from "@zoonk/ui/components/input";
import { PencilIcon } from "lucide-react";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { updateCourseAction } from "./_actions/update-course";

type EditedCourse = Pick<Course, "id" | "slug" | "title">;

function CourseFields({ course }: { course: EditedCourse }) {
  return (
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
  );
}

function SaveButton() {
  const status = useFormStatus();

  return (
    <EnterButton busy={status.pending} type="submit">
      Save changes
    </EnterButton>
  );
}

/**
 * A course's name and address, edited in the shared sheet: a bottom sheet on a phone, a centered
 * dialog on a computer. Why it couldn't save shows in the sheet, in a line that is always there.
 */
export function CourseEditButton({ course }: { course: EditedCourse }) {
  const [open, setOpen] = useState(false);

  const [state, formAction] = useAdminActionState<AdminActionState>({
    action: async (previous, formData) => {
      const { error } = await updateCourseAction(formData);

      if (!error) {
        setOpen(false);
      }

      return { error, submissionId: previous.submissionId + 1 };
    },
    initialState: { error: null, submissionId: 0 },
    report: "inline",
  });

  return (
    <Drawer onOpenChange={setOpen} open={open}>
      <DrawerTrigger
        render={
          <Button size="sm" variant="outline">
            <PencilIcon aria-hidden="true" />
            Edit
          </Button>
        }
      />

      <DrawerPopup>
        <DrawerHeader closeLabel="Close">
          <DrawerTitle>Edit this course</DrawerTitle>
        </DrawerHeader>

        <form action={formAction} className="contents">
          <DrawerContent className="flex flex-col gap-3 pt-2">
            <input name="id" type="hidden" value={course.id} />

            <CourseFields course={course} />

            {/* Always a line tall, so the sheet doesn't grow when the save fails. */}
            <p
              aria-live="polite"
              className="text-destructive-text min-h-4 text-xs"
              key={state.submissionId}
            >
              {state.error}
            </p>
          </DrawerContent>

          <DrawerFooter>
            <DrawerClose
              render={
                <Button size="lg" variant="outline">
                  Cancel
                </Button>
              }
            />
            <SaveButton />
          </DrawerFooter>
        </form>
      </DrawerPopup>
    </Drawer>
  );
}
