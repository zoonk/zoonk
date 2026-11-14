"use client";

import { notifyUsageDataChoice } from "@/lib/usage-data/usage-data-choice";
import { UsageDataSetting } from "@zoonk/learn/usage-data-setting";
import { setShareUsageDataAction } from "./actions";

async function saveShare(share: boolean): Promise<boolean> {
  const saved = await setShareUsageDataAction(share);
  notifyUsageDataChoice();
  return saved;
}

export function UsageDataRow({ share }: { share: boolean }) {
  return <UsageDataSetting onChange={saveShare} share={share} />;
}
