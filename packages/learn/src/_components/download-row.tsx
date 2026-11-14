"use client";

import { Button } from "@zoonk/ui/components/button";
import { showErrorToast } from "@zoonk/ui/components/toast";
import { downloadFile } from "@zoonk/utils/download";
import { safeAsync } from "@zoonk/utils/error";
import { DownloadIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useTransition } from "react";
import { SettingRow } from "./setting-rows";

/**
 * A settings row that downloads the learner's own data as one JSON file. A failure is said in a
 * toast, so the rows under it stay where they are.
 */
export function DownloadRow({
  fileName,
  label,
  load,
}: {
  fileName: string;
  label: string;
  load: () => Promise<unknown>;
}) {
  const t = useExtracted();
  const [isPending, startTransition] = useTransition();

  const download = () => {
    startTransition(async () => {
      const { data } = await safeAsync(load);

      if (!data) {
        showErrorToast(t("We couldn't prepare the download. Try again."));
        return;
      }

      downloadFile(JSON.stringify(data, null, 2), fileName, "application/json");
    });
  };

  return (
    <SettingRow label={label}>
      <form action={() => download()} className="contents">
        <Button
          aria-label={label}
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
  );
}
