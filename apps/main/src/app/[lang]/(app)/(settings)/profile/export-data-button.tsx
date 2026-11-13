"use client";

import { DownloadRow } from "@zoonk/learn/download-row";
import { useExtracted } from "next-intl";
import { exportAccountDataAction } from "./export-data-action";

/** A row of the profile's "Your data" list. */
export function ExportDataRow() {
  const t = useExtracted();

  return (
    <DownloadRow
      fileName="zoonk-data.json"
      label={t("Download my data")}
      load={exportAccountDataAction}
    />
  );
}
