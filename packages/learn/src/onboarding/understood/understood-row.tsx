"use client";

import { Badge } from "@zoonk/ui/components/badge";
import { Button } from "@zoonk/ui/components/button";
import { Input } from "@zoonk/ui/components/input";
import { cn } from "@zoonk/ui/lib/utils";
import {
  BriefcaseBusinessIcon,
  CalendarDaysIcon,
  ClockIcon,
  FlagIcon,
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
import { type UnderstoodRow as Row, type UnderstoodRowIcon } from "./use-understood-rows";

const ICONS: Record<UnderstoodRowIcon, React.ComponentType<{ className?: string }>> = {
  calendar: CalendarDaysIcon,
  clock: ClockIcon,
  course: GraduationCapIcon,
  goal: TargetIcon,
  language: LanguagesIcon,
  level: GaugeIcon,
  reason: PlaneIcon,
  speaks: MessageCircleIcon,
  target: TrophyIcon,
  work: BriefcaseBusinessIcon,
  year: FlagIcon,
};

/** Years ahead the card accepts for an exam: sooner than that, nobody plans yet. */
const MAX_YEARS_AHEAD = 10;

type EditorType = NonNullable<Row["editable"]>["kind"];

/** The editor's native limits: no day before today, and an exam year from this one on. */
function getInputLimits(type: EditorType) {
  const today = new Date();

  if (type === "date") {
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return { min: `${today.getFullYear()}-${month}-${day}` };
  }

  if (type === "year") {
    const year = today.getFullYear();
    return { inputMode: "numeric" as const, max: year + MAX_YEARS_AHEAD, min: year, step: 1 };
  }

  return {};
}

function SourceBadge({ source }: { source: NonNullable<Row["source"]> }) {
  const t = useExtracted();

  const host = URL.canParse(source.url)
    ? new URL(source.url).hostname.replace(/^www\./u, "")
    : null;

  return (
    <a
      className="text-success bg-success/10 focus-visible:ring-ring/50 inline-flex min-h-6 items-center gap-1 rounded-full px-2 text-xs font-medium outline-none focus-visible:ring-[3px]"
      href={source.url}
      rel="noreferrer"
      target="_blank"
    >
      <ShieldCheckIcon aria-hidden="true" className="size-3" />
      {t("source: {source}", { source: source.title ?? host ?? source.url })}
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
        type={type === "year" ? "number" : type}
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

/**
 * One understood fact: what it is, the value, where it came from, and a pencil to fix it in
 * place. Official exam dates keep their source one tap away; picking another day replaces them.
 * Closing the editor gives focus back to the pencil (`focusEdit`), so keyboard users keep their place.
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

  return (
    <li className="flex items-start gap-3 py-3.5 first:pt-1 last:pb-1">
      <span className="bg-muted mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full">
        <Icon aria-hidden="true" className="size-4.5" />
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-muted-foreground text-xs">{row.label}</span>

        {editing && row.editable ? (
          <RowEditor
            defaultValue={editValue}
            label={row.label}
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
      </div>

      {row.editable && !editing && (
        <Button
          aria-label={t("Edit {field}", { field: row.label })}
          autoFocus={focusEdit}
          className={cn("text-muted-foreground -mr-2 shrink-0")}
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
