"use client";

import {
  ListGroup,
  ListRowButton,
  ListRowContent,
  ListRowDescription,
  ListRowIcon,
  ListRowTitle,
} from "@zoonk/learn/list";
import { downloadFile } from "@zoonk/utils/download";
import { safeAsync } from "@zoonk/utils/error";
import { DownloadIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { exportAccountDataAction } from "./export-data-action";

/**
 * "Download my data" as a row of the profile's "Your data": everything Zoonk keeps about the learner
 * (profile, goals, plans, progress, answers, memory and feedback) in one file.
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
        <ListRowButton disabled={isPending} onClick={download}>
          <ListRowIcon className="size-8 self-center rounded-lg [&_svg]:size-4">
            <DownloadIcon />
          </ListRowIcon>
          <ListRowContent>
            <ListRowTitle>
              {isPending ? t("Preparing your data…") : t("Download my data")}
            </ListRowTitle>
            <ListRowDescription>{t("Everything Zoonk keeps about you")}</ListRowDescription>
          </ListRowContent>
        </ListRowButton>
      </ListGroup>
      {failed && (
        <p className="text-destructive px-4 text-sm" role="alert">
          {t("We couldn't prepare the download. Try again.")}
        </p>
      )}
    </div>
  );
}
