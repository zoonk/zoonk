"use client";

import {
  AdminEditForm,
  AdminEditFormActions,
  AdminEditFormFeedback,
} from "@/components/admin-edit-form";
import { type CoursePrompt } from "@zoonk/db";
import { buttonVariants } from "@zoonk/ui/components/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@zoonk/ui/components/field";
import { Input } from "@zoonk/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@zoonk/ui/components/native-select";
import { SubmitButton } from "@zoonk/ui/patterns/buttons/submit";
import { CheckIcon } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import {
  type UpdateCoursePromptState,
  updateCoursePromptAction,
} from "./_actions/update-course-prompt";

/**
 * Database enums use stable lowercase values, while the form presents them as
 * human-readable labels without maintaining a second label map.
 */
function getOptionLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * The prompt editor keeps the submitted text as read-only context and exposes
 * only the classification fields admins are expected to correct.
 */
export function CoursePromptForm({
  courseFormats,
  intents,
  prompt,
}: {
  courseFormats: NonNullable<CoursePrompt["courseFormat"]>[];
  intents: CoursePrompt["intent"][];
  prompt: Pick<
    CoursePrompt,
    "canonicalTitle" | "courseFormat" | "generationStatus" | "id" | "intent" | "language" | "prompt"
  >;
}) {
  const [state, formAction] = useActionState(updateCoursePromptAction, {
    canEditGenerationStatus: prompt.generationStatus === null,
    canonicalTitle: prompt.canonicalTitle ?? "",
    courseFormat: prompt.courseFormat,
    error: null,
    generationStatus: prompt.generationStatus,
    intent: prompt.intent,
    status: "idle",
    submissionId: 0,
  } satisfies UpdateCoursePromptState);

  return (
    <AdminEditForm action={formAction}>
      <input name="id" type="hidden" value={prompt.id} />

      <div className="border-b pb-6">
        <p className="text-muted-foreground mb-1 text-sm">Submitted prompt</p>
        <p className="leading-relaxed font-medium">{prompt.prompt}</p>
        <p className="text-muted-foreground mt-1 text-xs uppercase">{prompt.language}</p>
      </div>

      <FieldGroup>
        <Field>
          <FieldContent>
            <FieldLabel htmlFor="intent">Intent</FieldLabel>
            <NativeSelect
              className="w-full"
              defaultValue={state.intent}
              id="intent"
              key={state.intent}
              name="intent"
            >
              {intents.map((intent) => (
                <NativeSelectOption key={intent} value={intent}>
                  {getOptionLabel(intent)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </FieldContent>
        </Field>

        <Field>
          <FieldContent>
            <FieldLabel htmlFor="courseFormat">Course format</FieldLabel>
            <NativeSelect
              className="w-full"
              defaultValue={state.courseFormat ?? ""}
              id="courseFormat"
              key={state.courseFormat ?? "no-course-format"}
              name="courseFormat"
            >
              <NativeSelectOption value="">No course format</NativeSelectOption>
              {courseFormats.map((courseFormat) => (
                <NativeSelectOption key={courseFormat} value={courseFormat}>
                  {getOptionLabel(courseFormat)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </FieldContent>
        </Field>

        <Field>
          <FieldContent>
            <FieldLabel htmlFor="canonicalTitle">Canonical title</FieldLabel>
            <Input
              defaultValue={state.canonicalTitle}
              id="canonicalTitle"
              key={state.canonicalTitle}
              name="canonicalTitle"
              placeholder="No canonical title"
            />
            <FieldDescription>
              Leave blank when this prompt should not have a canonical title.
            </FieldDescription>
          </FieldContent>
        </Field>

        <GenerationStatusField
          canEdit={state.canEditGenerationStatus}
          generationStatus={state.generationStatus}
        />
      </FieldGroup>

      <AdminEditFormFeedback
        error={state.status === "error" ? state.error : null}
        submissionId={state.submissionId}
        successMessage={state.status === "success" ? "Course prompt updated successfully." : null}
      />

      <AdminEditFormActions>
        <Link className={buttonVariants({ variant: "outline" })} href="/course-prompts">
          Cancel
        </Link>
        <SubmitButton icon={<CheckIcon />}>Save changes</SubmitButton>
      </AdminEditFormActions>
    </AdminEditForm>
  );
}

/**
 * Null statuses are the only workflow state this editor can advance. Once a
 * workflow owns the prompt, the current state stays visible but read-only.
 */
function GenerationStatusField({
  canEdit,
  generationStatus,
}: {
  canEdit: boolean;
  generationStatus: CoursePrompt["generationStatus"];
}) {
  if (!canEdit) {
    return (
      <Field>
        <FieldContent>
          <FieldLabel htmlFor="generationStatus">Generation status</FieldLabel>
          <Input
            className="capitalize"
            disabled
            id="generationStatus"
            value={generationStatus ?? "No generation"}
          />
          <FieldDescription>The generation workflow owns this status.</FieldDescription>
        </FieldContent>
      </Field>
    );
  }

  return (
    <Field>
      <FieldContent>
        <FieldLabel htmlFor="generationStatus">Generation status</FieldLabel>
        <NativeSelect
          className="w-full"
          defaultValue={generationStatus ?? ""}
          id="generationStatus"
          key={generationStatus ?? "no-generation"}
          name="generationStatus"
        >
          <NativeSelectOption value="">No generation</NativeSelectOption>
          <NativeSelectOption value="pending">Pending</NativeSelectOption>
        </NativeSelect>
        <FieldDescription>
          Pending requires a learn intent, canonical title, and supported core or language format.
        </FieldDescription>
      </FieldContent>
    </Field>
  );
}
