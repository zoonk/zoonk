"use client";

import { Badge } from "@zoonk/ui/components/badge";
import { Button } from "@zoonk/ui/components/button";
import { Input } from "@zoonk/ui/components/input";
import {
  BriefcaseBusinessIcon,
  CalendarDaysIcon,
  ClockIcon,
  FileTextIcon,
  GaugeIcon,
  GraduationCapIcon,
  LanguagesIcon,
  MessageCircleIcon,
  PencilIcon,
  PlaneIcon,
  ShieldCheckIcon,
  TargetIcon,
  TrophyIcon,
} from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useState, useTransition } from "react";
import { toLocalIsoDate, useFormatIsoDate } from "../../_utils/iso-date";
import { UseDateButton } from "../../plan/notice-day";
import { type UnderstoodRow as Row, type UnderstoodRowIcon } from "./use-understood-rows";

const ICONS: Record<UnderstoodRowIcon, React.ComponentType<{ className?: string }>> = {
  calendar: CalendarDaysIcon,
  clock: ClockIcon,
  course: GraduationCapIcon,
  goal: TargetIcon,
  language: LanguagesIcon,
  level: GaugeIcon,
  material: FileTextIcon,
  reason: PlaneIcon,
  speaks: MessageCircleIcon,
  target: TrophyIcon,
  work: BriefcaseBusinessIcon,
};

type EditorType = NonNullable<Row["editable"]>["kind"];

/** The editor's native limits: no day before today. */
function getInputLimits(type: EditorType) {
  return type === "date" ? { min: toLocalIsoDate(new Date()) } : {};
}

/** Past this, a notice's title (often its whole heading, in capitals) reads as its site instead. */
const MAX_SOURCE_TITLE_LENGTH = 40;

/** The source as a few words: its short title, else the site it's on ("cebraspe.org.br"). */
function getSourceName(source: NonNullable<Row["source"]>): string {
  const host = URL.canParse(source.url)
    ? new URL(source.url).hostname.replace(/^www\./u, "")
    : null;

  const title = source.title?.trim();
  return title && title.length <= MAX_SOURCE_TITLE_LENGTH ? title : (host ?? source.url);
}

function SourceBadge({ source }: { source: NonNullable<Row["source"]> }) {
  const t = useExtracted();

  return (
    <a
      className="text-success bg-success/10 focus-visible:ring-ring/50 inline-flex min-h-6 max-w-full items-center gap-1 rounded-full px-2 text-xs font-medium outline-none focus-visible:ring-[3px]"
      href={source.url}
      rel="noreferrer"
      target="_blank"
      title={source.title ?? undefined}
    >
      <ShieldCheckIcon aria-hidden="true" className="size-3 shrink-0" />
      <span className="truncate">{t("source: {source}", { source: getSourceName(source) })}</span>
    </a>
  );
}

function RowEditor({
  defaultValue,
  label,
  onCancel,
  onSave,
  type,
}: {
  defaultValue: string;
  label: string;
  onCancel: () => void;
  /** Saves the fix; false when it couldn't be saved, so the editor stays open to try again. */
  onSave: (value: string) => Promise<boolean>;
  type: EditorType;
}) {
  const t = useExtracted();
  const inputId = useId();
  const [value, setValue] = useState(defaultValue);
  const [failed, setFailed] = useState(false);
  const [isSaving, startSaving] = useTransition();

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();

        if (!value.trim()) {
          return;
        }

        startSaving(async () => {
          setFailed(false);
          setFailed(!(await onSave(value.trim())));
        });
      }}
    >
      <label className="sr-only" htmlFor={inputId}>
        {label}
      </label>
      <Input
        autoFocus
        id={inputId}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => event.key === "Escape" && onCancel()}
        type={type}
        value={value}
        {...getInputLimits(type)}
      />
      {failed && (
        <p className="text-destructive text-sm" role="alert">
          {t("We couldn't save that. Try again in a moment.")}
        </p>
      )}
      <div className="flex gap-2">
        <Button disabled={isSaving} size="sm" type="submit">
          {isSaving ? t("Saving…") : t("Save")}
        </Button>
        <Button disabled={isSaving} onClick={onCancel} size="sm" type="button" variant="ghost">
          {t("Cancel")}
        </Button>
      </div>
    </form>
  );
}

/** "Use this date" for the notice's day, saved as the row's date, with a word when it isn't. */
function SuggestedDate({
  date,
  onSave,
}: {
  date: string;
  onSave: (value: string) => Promise<boolean>;
}) {
  const t = useExtracted();
  const [failed, setFailed] = useState(false);

  return (
    <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
      <UseDateButton
        onUse={async () => {
          setFailed(false);
          setFailed(!(await onSave(date)));
        }}
      />
      {failed && (
        <span className="text-destructive text-sm" role="alert">
          {t("We couldn't save that. Try again in a moment.")}
        </span>
      )}
    </span>
  );
}

/** The dates the row's date is picked from (an exam's next sittings), each saved with one tap. */
function ChoiceDates({
  dates,
  onSave,
}: {
  dates: string[];
  onSave: (value: string) => Promise<boolean>;
}) {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const [failed, setFailed] = useState(false);
  const [isSaving, startSaving] = useTransition();

  return (
    <span className="mt-1.5 flex flex-wrap items-center gap-2">
      {dates.map((date) => (
        <Button
          disabled={isSaving}
          focusableWhenDisabled
          key={date}
          onClick={() =>
            startSaving(async () => {
              setFailed(false);
              setFailed(!(await onSave(date)));
            })
          }
          size="sm"
          type="button"
          variant="outline"
        >
          {formatDate(date, "short")}
        </Button>
      ))}
      {failed && (
        <span className="text-destructive text-sm" role="alert">
          {t("We couldn't save that. Try again in a moment.")}
        </span>
      )}
    </span>
  );
}

/**
 * One understood fact: what it is, the value, where it came from, and a pencil to fix it in
 * place. Official exam dates keep their source one tap away, and the notice's day, when the date
 * is another, one tap to take. Closing the editor gives focus back to the pencil (`focusEdit`), so
 * keyboard users keep their place.
 */
export function UnderstoodRowItem({
  editValue,
  editing,
  focusEdit,
  onEdit,
  onSave,
  row,
}: {
  editValue: string;
  editing: boolean;
  focusEdit: boolean;
  onEdit: (editing: boolean) => void;
  /** Saves the fix; false when it couldn't be saved. */
  onSave: (value: string) => Promise<boolean>;
  row: Row;
}) {
  const t = useExtracted();
  const Icon = ICONS[row.icon];
  const label = editing ? (row.editLabel ?? row.label) : row.label;

  return (
    <li className="flex items-start gap-3 py-3.5 first:pt-1 last:pb-1">
      <span className="bg-muted mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full">
        <Icon aria-hidden="true" className="size-4.5" />
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-muted-foreground text-xs">{label}</span>

        {editing && row.editable ? (
          <RowEditor
            defaultValue={editValue}
            label={label}
            onCancel={() => onEdit(false)}
            onSave={async (value) => {
              const saved = await onSave(value);

              if (saved) {
                onEdit(false);
              }

              return saved;
            }}
            type={row.editable.kind}
          />
        ) : (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-base font-medium">{row.value}</span>
            {row.badge && (
              <Badge className="bg-warning/15 text-warning border-transparent" variant="outline">
                {row.badge}
              </Badge>
            )}
          </span>
        )}

        {(row.note || row.source) && !editing && (
          <span className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
            {row.note}
            {row.source && <SourceBadge source={row.source} />}
          </span>
        )}

        {row.suggestedDate && !editing && (
          <SuggestedDate date={row.suggestedDate} onSave={onSave} />
        )}

        {row.choiceDates && !editing && <ChoiceDates dates={row.choiceDates} onSave={onSave} />}
      </div>

      {row.editable && !editing && (
        <Button
          aria-label={t("Edit {field}", { field: row.label })}
          autoFocus={focusEdit}
          className="text-muted-foreground -mr-2 shrink-0"
          onClick={() => onEdit(true)}
          size="icon"
          variant="ghost"
        >
          <PencilIcon aria-hidden="true" />
        </Button>
      )}
    </li>
  );
}
