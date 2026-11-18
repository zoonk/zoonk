import { formatDate, formatDateTime } from "@/lib/format";
import { StateMark } from "./state-mark";

function isPast(date: Date): boolean {
  return date < new Date();
}

export function AdminCheckDate({
  date,
  dateTime = false,
  kind,
  prefix,
}: {
  date: Date | null;
  dateTime?: boolean;
  kind: "next-check" | "valid-until";
  prefix?: string;
}) {
  if (!date) {
    return kind === "valid-until" ? "No end date" : "No check is scheduled.";
  }

  const expires = kind === "valid-until";
  const label = dateTime ? formatDateTime(date) : formatDate(date);

  return (
    <span className="inline-flex flex-wrap gap-x-2 gap-y-1 in-[td]:justify-end">
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
