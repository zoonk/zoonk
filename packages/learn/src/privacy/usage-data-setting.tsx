"use client";

import { useExtracted } from "next-intl";
import { useOptimistic } from "react";
import { SwitchSettingRow } from "../_components/setting-rows";
import { useOptimisticSave } from "../_utils/use-optimistic-save";

/** `onChange` resolves to whether the choice was saved. */
export function UsageDataSetting({
  onChange,
  share,
}: {
  onChange: (share: boolean) => Promise<boolean>;
  share: boolean;
}) {
  const t = useExtracted();
  const [shown, setOptimisticShare] = useOptimistic(share);
  const { run } = useOptimisticSave();

  return (
    <SwitchSettingRow
      checked={shown}
      description={t("Shows us how you use Zoonk, so we can improve it")}
      label={t("Share usage data")}
      onCheckedChange={(next) =>
        run(
          () => setOptimisticShare(next),
          () => onChange(next),
        )
      }
    />
  );
}
