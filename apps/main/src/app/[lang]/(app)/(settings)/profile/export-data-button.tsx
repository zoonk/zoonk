"use client";

import { ListGroup } from "@zoonk/learn/list";
import { SettingRow } from "@zoonk/learn/setting-rows";
import { Button } from "@zoonk/ui/components/button";
import { downloadFile } from "@zoonk/utils/download";
import { safeAsync } from "@zoonk/utils/error";
import { DownloadIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { exportAccountDataAction } from "./export-data-action";

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
            aria-label={t("Download my data")}
            busy={isPending}
            icon={<DownloadIcon aria-hidden="true" />}
            onClick={download}
            size="sm"
            variant="outline"
          >
            {t("Download")}
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
