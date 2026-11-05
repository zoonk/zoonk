"use client";

import { getTargetDateBounds } from "@zoonk/core/plans/target-date-range";
import { Button } from "@zoonk/ui/components/button";
import { Input } from "@zoonk/ui/components/input";
import { useMountTime } from "@zoonk/ui/hooks/mount-time";
import { ArrowUpRightIcon, PencilIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useState, useTransition } from "react";
import { ChangeSaveError } from "../../_components/save-error";
import { getTodayInZone, useFormatIsoDate } from "../../_utils/iso-date";
import { UseDateButton } from "../../plan/notice-day";
import { type UnderstoodRow as Row } from "./use-understood-rows";

type EditorType = NonNullable<Row["editable"]>["kind"];

/** The deadlines a fix can save, counted from when the editor or button appeared. */
function useDateBounds(timeZone: string) {
  return getTargetDateBounds(getTodayInZone({ now: useMountTime(), timeZone }));
}

function isWithin({ bounds, date }: { bounds: { max: string; min: string }; date: string }) {
  return date >= bounds.min && date <= bounds.max;
}

const MAX_SOURCE_TITLE_LENGTH = 40;

function getSourceName(source: NonNullable<Row["source"]>): string {
  const host = URL.canParse(source.url)
    ? new URL(source.url).hostname.replace(/^www\./u, "")
    : null;

  const title = source.title?.trim();
  return title && title.length <= MAX_SOURCE_TITLE_LENGTH ? title : (host ?? source.url);
}

function SourceLink({ source }: { source: NonNullable<Row["source"]> }) {
  const t = useExtracted();

  return (
    <a
      className="hover:text-foreground focus-visible:ring-ring/50 inline-flex max-w-full items-center gap-0.5 rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-[3px]"
      href={source.url}
      rel="noreferrer"
      target="_blank"
      title={source.title ?? undefined}
    >
      <span className="truncate">{t("Source: {source}", { source: getSourceName(source) })}</span>
      <ArrowUpRightIcon aria-hidden="true" className="size-3 shrink-0" />
    </a>
  );
}

function RowEditor({
  defaultValue,
  label,
  onCancel,
  onSave,
  timeZone,
  type,
}: {
  defaultValue: string;
  label: string;
  onCancel: () => void;
  /** False when it couldn't be saved, which keeps the editor open. */
  onSave: (value: string) => Promise<boolean>;
  timeZone: string;
  type: EditorType;
}) {
  const t = useExtracted();
  const bounds = useDateBounds(timeZone);
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
        {...(type === "date" ? bounds : {})}
      />
      {failed && <ChangeSaveError />}
      <div className="flex gap-2">
        <Button disabled={isSaving} focusableWhenDisabled size="sm" type="submit">
          {isSaving ? t("Saving…") : t("Save")}
        </Button>
        <Button
          disabled={isSaving}
          focusableWhenDisabled
          onClick={onCancel}
          size="sm"
          type="button"
          variant="ghost"
        >
          {t("Cancel")}
        </Button>
      </div>
    </form>
  );
}

function SuggestedDate({
  date,
  onSave,
  timeZone,
}: {
  date: string;
  onSave: (value: string) => Promise<boolean>;
  timeZone: string;
}) {
  const [failed, setFailed] = useState(false);
  const bounds = useDateBounds(timeZone);

  if (!isWithin({ bounds, date })) {
    return null;
  }

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
      <UseDateButton
        onUse={async () => {
          setFailed(false);
          setFailed(!(await onSave(date)));
        }}
      />
      {failed && <ChangeSaveError />}
    </div>
  );
}

function ChoiceDates({
  dates,
  onSave,
  timeZone,
}: {
  dates: string[];
  onSave: (value: string) => Promise<boolean>;
  timeZone: string;
}) {
  const formatDate = useFormatIsoDate();
  const [failed, setFailed] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const bounds = useDateBounds(timeZone);
  const offered = dates.filter((date) => isWithin({ bounds, date }));

  if (offered.length === 0) {
    return null;
  }

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2">
      {offered.map((date) => (
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
      {failed && <ChangeSaveError />}
    </div>
  );
}

const FACT_ROW_CLASS =
  "group/fact flex items-start gap-3 py-3 sm:grid sm:grid-cols-[9rem_minmax(0,1fr)_auto]";

const LABEL_CLASS = "text-muted-foreground text-[0.8125rem] sm:pt-px";

function RowFact({ row }: { row: Row }) {
  return (
    <>
      <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-[0.9375rem] font-medium">{row.value}</span>
        {row.badge && <span className="text-muted-foreground text-xs">{row.badge}</span>}
      </span>

      {(row.note || row.source) && (
        <span className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          {row.note}
          {row.note && row.source && <span aria-hidden="true">{" · "}</span>}
          {row.source && <SourceLink source={row.source} />}
        </span>
      )}
    </>
  );
}

export function UnderstoodFactItem({ row }: { row: Row }) {
  return (
    <li className={FACT_ROW_CLASS}>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:contents">
        <span className={LABEL_CLASS}>{row.label}</span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <RowFact row={row} />
        </div>
      </div>
    </li>
  );
}

export function UnderstoodRowItem({
  editValue,
  editing,
  focusEdit,
  onEdit,
  onSave,
  row,
  timeZone,
}: {
  editValue: string;
  editing: boolean;
  focusEdit: boolean;
  onEdit: (editing: boolean) => void;
  onSave: (value: string) => Promise<boolean>;
  row: Row;
  timeZone: string;
}) {
  const t = useExtracted();
  const label = editing ? (row.editLabel ?? row.label) : row.label;

  return (
    <li className={FACT_ROW_CLASS}>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:contents">
        <span className={LABEL_CLASS}>{label}</span>

        <div className="flex min-w-0 flex-col gap-0.5">
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
              timeZone={timeZone}
              type={row.editable.kind}
            />
          ) : (
            <RowFact row={row} />
          )}

          {row.suggestedDate && !editing && (
            <SuggestedDate date={row.suggestedDate} onSave={onSave} timeZone={timeZone} />
          )}

          {row.choiceDates && !editing && (
            <ChoiceDates dates={row.choiceDates} onSave={onSave} timeZone={timeZone} />
          )}
        </div>
      </div>

      {row.editable && !editing && (
        <Button
          aria-label={t("Edit {field}", { field: row.label })}
          autoFocus={focusEdit}
          className="text-muted-foreground -my-1.5 -mr-2 shrink-0 focus-visible:opacity-100 pointer-fine:opacity-0 pointer-fine:group-hover/fact:opacity-100"
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
