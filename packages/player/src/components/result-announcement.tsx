"use client";

import { useExtracted } from "next-intl";

export function ResultAnnouncement({ isCorrect }: { isCorrect: boolean }) {
  const t = useExtracted();

  return (
    <div aria-live="polite" className="sr-only" role="status">
      {isCorrect ? t("Correct") : t("Incorrect")}
    </div>
  );
}
