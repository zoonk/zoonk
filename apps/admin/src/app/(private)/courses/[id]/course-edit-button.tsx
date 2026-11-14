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

function SaveButton() {
  const status = useFormStatus();

  return (
    <EnterButton busy={status.pending} type="submit">
      Save changes
    </EnterButton>
  );
}

/**
 * The sheet's form. It mounts when the sheet opens, so closing the sheet drops the draft. While it
 * is open the draft is in state: React resets uncontrolled fields after a form action, and a save
 * the server refuses keeps what was typed.
 */
function CourseEditForm({ course, onSaved }: { course: EditedCourse; onSaved: () => void }) {
  const [title, setTitle] = useState(course.title);
  const [slug, setSlug] = useState(course.slug);

  const [state, formAction] = useAdminActionState<AdminActionState>({
    action: async (previous, formData) => {
      const { error } = await updateCourseAction(formData);

      if (!error) {
        onSaved();
      }

      return { error, submissionId: previous.submissionId + 1 };
    },
    initialState: { error: null, submissionId: 0 },
    report: "inline",
  });

  return (
    <form action={formAction} className="contents">
      <DrawerContent className="flex flex-col gap-3 pt-2">
        <input name="id" type="hidden" value={course.id} />

        <FieldGroup>
          <Field>
            <FieldContent>
              <FieldLabel htmlFor="title">Title</FieldLabel>
              <Input
                id="title"
                name="title"
                onChange={(event) => setTitle(event.target.value)}
                required
                value={title}
              />
            </FieldContent>
          </Field>

          <Field>
            <FieldContent>
              <FieldLabel htmlFor="slug">Slug</FieldLabel>
              <Input
                autoCapitalize="none"
                autoCorrect="off"
                id="slug"
                name="slug"
                onChange={(event) => setSlug(event.target.value)}
                required
                spellCheck={false}
                value={slug}
              />
              <FieldDescription>Changing it breaks existing links to this course.</FieldDescription>
            </FieldContent>
          </Field>
        </FieldGroup>

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
  );
}

/**
 * A course's name and address, edited in the shared sheet: a bottom sheet on a phone, a centered
 * dialog on a computer. Why it couldn't save shows in the sheet, in a line that is always there.
 */
export function CourseEditButton({ course }: { course: EditedCourse }) {
  const [open, setOpen] = useState(false);

  return (
    <Drawer onOpenChange={setOpen} open={open}>
      <DrawerTrigger
        render={
          <Button size="bar" variant="outline">
            <PencilIcon aria-hidden="true" />
            Edit
          </Button>
        }
      />

      <DrawerPopup>
        <DrawerHeader closeLabel="Close">
          <DrawerTitle>Edit this course</DrawerTitle>
        </DrawerHeader>

        <CourseEditForm course={course} onSaved={() => setOpen(false)} />
      </DrawerPopup>
    </Drawer>
  );
}
