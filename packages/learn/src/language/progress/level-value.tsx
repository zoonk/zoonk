"use client";

import { useExtracted } from "next-intl";

export function LevelValue({ label, target }: { label: string; target: string | null }) {
  const t = useExtracted();

  return (
    <>
      {label}
      {target && (
        <span className="text-muted-foreground text-base whitespace-nowrap">
          {" → "}
          <span className="sr-only">{`${t("goal")} `}</span>
          {target}
        </span>
      )}
    </>
  );
}
