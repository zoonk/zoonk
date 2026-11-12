"use client";

import { SettingRow } from "@zoonk/learn/setting-rows";
import { Button } from "@zoonk/ui/components/button";
import { downloadFile } from "@zoonk/utils/download";
import { safeAsync } from "@zoonk/utils/error";
import { DownloadIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { exportAccountDataAction } from "./export-data-action";

/** A row of the profile's "Your data" list. */
export function ExportDataRow() {
  const t = useExtracted();
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  const download = () => {
    startTransition(async () => {
      const { data } = await safeAsync(exportAccountDataAction);
      setFailed(!data);

      if (data) {
        downloadFile(JSON.stringify(data, null, 2), "zoonk-data.json", "application/json");
      }
    });
  };

  return (
    <div className="flex flex-col">
      <SettingRow label={t("Download my data")}>
        <form action={() => download()} className="contents">
          <Button
            aria-label={t("Download my data")}
            busy={isPending}
            icon={<DownloadIcon aria-hidden="true" />}
            size="sm"
            type="submit"
            variant="outline"
          >
            {t("Download")}
          </Button>
        </form>
      </SettingRow>

      {failed && (
        <p className="text-destructive-text pb-3 text-sm" role="alert">
          {t("We couldn't prepare the download. Try again.")}
        </p>
      )}
    </div>
  );
}
