"use client";

import { useExtracted } from "next-intl";

/**
 * A language goal's level as its number, with the level it aims for after it, smaller and muted
 * ("A2+ → B1+"), kept on one line: the Plan's first number and Today's aside say it alike.
 */
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
