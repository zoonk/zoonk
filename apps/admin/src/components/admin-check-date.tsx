import { formatDate, formatDateTime } from "@/lib/format";
import { StateMark } from "./state-mark";

function isPast(date: Date): boolean {
  return date < new Date();
}

/** A date and, once it has passed, its mark beside it on the same line. */
export function AdminCheckDate({
  date,
  dateTime = false,
  emptyLabel,
  kind,
  prefix,
}: {
  date: Date | null;
  dateTime?: boolean;
  /** A table's empty cell is a dash, like every other one. */
  emptyLabel?: string;
  kind: "next-check" | "valid-until";
  prefix?: string;
}) {
  if (!date) {
    return emptyLabel ?? (kind === "valid-until" ? "No end date" : "No check scheduled");
  }

  const expires = kind === "valid-until";
  const label = dateTime ? formatDateTime(date) : formatDate(date);

  return (
    <span className="inline-flex flex-wrap gap-x-2 gap-y-1 in-[td]:flex-nowrap in-[td]:justify-end">
      <span>
        {prefix}
        <span className="whitespace-nowrap">{label}</span>
      </span>
      {isPast(date) && (
        <StateMark state={expires ? "out_of_date" : "past_due"}>
          {expires ? undefined : "Overdue"}
        </StateMark>
      )}
    </span>
  );
}
