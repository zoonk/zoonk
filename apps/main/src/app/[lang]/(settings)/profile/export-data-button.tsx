"use client";

import { Button } from "@zoonk/ui/components/button";
import { downloadFile } from "@zoonk/utils/download";
import { safeAsync } from "@zoonk/utils/error";
import { DownloadIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { exportAccountDataAction } from "./export-data-action";

/** Downloads the learner's data (profile, goals, plans, progress, answers, memory and feedback). */
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
    <div className="flex flex-col items-start gap-2">
      <Button disabled={isPending} onClick={download} variant="outline">
        <DownloadIcon aria-hidden="true" />
        {isPending ? t("Preparing your data…") : t("Download my data")}
      </Button>
      {failed && (
        <p className="text-destructive text-sm" role="alert">
          {t("We couldn't prepare the download. Try again.")}
        </p>
      )}
    </div>
  );
}
