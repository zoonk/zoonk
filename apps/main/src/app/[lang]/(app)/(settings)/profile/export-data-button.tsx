"use client";

import { ListGroup } from "@zoonk/learn/list";
import { SettingRow } from "@zoonk/learn/setting-rows";
import { Button } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { downloadFile } from "@zoonk/utils/download";
import { safeAsync } from "@zoonk/utils/error";
import { DownloadIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { exportAccountDataAction } from "./export-data-action";

/**
 * "Download my data" as a row of the profile's "Your data": everything Zoonk keeps about the learner
 * (profile, goals, plans, progress, answers, memory and feedback) in one file, with a small
 * Download at the row's end that says when the file is being prepared.
 */
export function ExportDataButton() {
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
    <div className="flex flex-col gap-2">
      <ListGroup>
        <SettingRow
          description={t("Everything Zoonk keeps about you, as one file")}
          label={t("Download my data")}
        >
          <Button
            aria-label={isPending ? t("Preparing your data…") : t("Download my data")}
            disabled={isPending}
            onClick={download}
            size="sm"
            variant="outline"
          >
            {isPending ? <Spinner aria-hidden="true" /> : <DownloadIcon aria-hidden="true" />}
            {isPending ? t("Preparing…") : t("Download")}
          </Button>
        </SettingRow>
      </ListGroup>

      {failed && (
        <p className="text-destructive-text text-sm" role="alert">
          {t("We couldn't prepare the download. Try again.")}
        </p>
      )}
    </div>
  );
}
