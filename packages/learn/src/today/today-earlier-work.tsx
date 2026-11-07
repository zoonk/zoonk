"use client";

import { useExtracted } from "next-intl";
import { useTodayScreen } from "./today-context";

const OPEN_BACKLOG_LIMIT = 5;

export function TodayEarlierWork() {
  const t = useExtracted();
  const { today } = useTodayScreen();
  const items = today.earlierWork ?? [];

  if (items.length === 0) {
    return null;
  }

  return (
    <details className="mb-5 border-b pb-4 text-sm" open={items.length <= OPEN_BACKLOG_LIMIT}>
      <summary className="min-h-11 cursor-pointer py-3 font-medium">
        {t({
          description:
            "Study left over, not a job: lessons left unfinished on earlier days. {count} is how many.",
          message: "Earlier unfinished work · {count}",
          values: { count: String(items.length) },
        })}
      </summary>
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li key={item.id}>{item.title}</li>
        ))}
      </ul>
    </details>
  );
}
