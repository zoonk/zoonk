"use client";

import {
  ContainerHeader,
  ContainerHeaderGroup,
} from "@zoonk/ui/components/container";
import {
  EditableText,
  EditableTextarea,
} from "@zoonk/ui/components/editable-text";
import {
  combineSaveStatuses,
  SaveStatus,
} from "@zoonk/ui/components/save-status";
import { useExtracted } from "next-intl";
import { updateCourseAction } from "./actions";
import { useAutoSave } from "./use-auto-save";

export function CourseEditor({
  courseId,
  initialTitle,
  initialDescription,
}: {
  courseId: number;
  initialTitle: string;
  initialDescription: string;
}) {
  const t = useExtracted();

  const {
    status: titleStatus,
    value: title,
    setValue: setTitle,
  } = useAutoSave({
    initialValue: initialTitle,
    onSave: (value) => updateCourseAction(courseId, { title: value }),
  });

  const {
    status: descriptionStatus,
    value: description,
    setValue: setDescription,
  } = useAutoSave({
    initialValue: initialDescription,
    onSave: (value) => updateCourseAction(courseId, { description: value }),
  });

  const overallStatus = combineSaveStatuses(titleStatus, descriptionStatus);

  return (
    <ContainerHeader className="relative">
      <ContainerHeaderGroup className="flex-1">
        <EditableText
          aria-label={t("Edit course title")}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("Course title…")}
          value={title}
          variant="title"
        />

        <EditableTextarea
          aria-label={t("Edit course description")}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("Course description…")}
          value={description}
          variant="description"
        />
      </ContainerHeaderGroup>

      <SaveStatus
        className="absolute top-0 right-4"
        labels={{
          saved: t("Saved"),
          saving: t("Saving…"),
          unsaved: t("Unsaved"),
        }}
        status={overallStatus}
      />
    </ContainerHeader>
  );
}
