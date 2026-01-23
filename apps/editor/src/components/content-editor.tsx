"use client";

import { ContainerHeader, ContainerHeaderGroup } from "@zoonk/ui/components/container";
import { EditableText, EditableTextarea } from "@zoonk/ui/components/editable-text";
import { combineSaveStatuses, SaveStatus } from "@zoonk/ui/components/save-status";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { useAutoSave } from "@zoonk/ui/hooks/auto-save";
import { useExtracted } from "next-intl";

export function ContentEditorSkeleton() {
  return (
    <ContainerHeader>
      <ContainerHeaderGroup className="flex-1 gap-2">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </ContainerHeaderGroup>
    </ContainerHeader>
  );
}

type ContentEditorProps = {
  entityId: number;
  initialTitle: string;
  initialDescription: string;
  onSaveTitle: (id: number, data: { title: string }) => Promise<{ error: string | null }>;
  onSaveDescription: (
    id: number,
    data: { description: string },
  ) => Promise<{ error: string | null }>;
  titlePlaceholder: string;
  descriptionPlaceholder: string;
  titleLabel: string;
  descriptionLabel: string;
};

export function ContentEditor({
  entityId,
  initialTitle,
  initialDescription,
  onSaveTitle,
  onSaveDescription,
  titlePlaceholder,
  descriptionPlaceholder,
  titleLabel,
  descriptionLabel,
}: ContentEditorProps) {
  const t = useExtracted();

  const {
    status: titleStatus,
    value: title,
    setValue: setTitle,
  } = useAutoSave({
    initialValue: initialTitle,
    onSave: (value) => onSaveTitle(entityId, { title: value }),
  });

  const {
    status: descriptionStatus,
    value: description,
    setValue: setDescription,
  } = useAutoSave({
    initialValue: initialDescription,
    onSave: (value) => onSaveDescription(entityId, { description: value }),
  });

  const overallStatus = combineSaveStatuses(titleStatus, descriptionStatus);

  return (
    <ContainerHeader className="relative">
      <ContainerHeaderGroup className="flex-1">
        <EditableText
          aria-label={titleLabel}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={titlePlaceholder}
          value={title}
          variant="title"
        />

        <EditableTextarea
          aria-label={descriptionLabel}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={descriptionPlaceholder}
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
