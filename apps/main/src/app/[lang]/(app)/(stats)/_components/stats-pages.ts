import { useExtracted } from "next-intl";

/** The statistics pages after the overview, in the one order the tabs and the sidebar list them. */
export function useStatsPages() {
  const t = useExtracted();

  return [
    { label: t("Level"), menu: "level" },
    { label: t("Energy"), menu: "energy" },
    { label: t("Activity"), menu: "activity" },
    { label: t("Score"), menu: "score" },
    { label: t("Patterns"), menu: "patterns" },
  ] as const;
}
