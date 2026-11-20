"use client";

import { DownloadRow } from "@zoonk/learn/download-row";
import { useExtracted } from "next-intl";
import { exportAccountDataAction } from "./export-data-action";

/** A row of Privacy's "Your data" list. */
export function ExportDataRow() {
  const t = useExtracted();

  return (
    <DownloadRow
      actionLabel={t("Download your data")}
      fileName="zoonk-data.json"
      label={t("A copy of your data")}
      load={exportAccountDataAction}
    />
  );
}
