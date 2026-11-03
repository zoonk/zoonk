"use client";

import { useExtracted } from "next-intl";

export function NotQuiteLead() {
  const t = useExtracted();

  return (
    <span className="text-destructive-text font-semibold">
      {t({
        description: "Starts the explanation of why the learner's answer is wrong.",
        message: "Not quite:",
      })}
    </span>
  );
}
