import { getWebPlusCancellation } from "@zoonk/core/subscriptions/web-plus-cancellation";
import { safeAsync } from "@zoonk/utils/error";
import { getExtracted } from "next-intl/server";

export async function DeletionPlusNotice() {
  const t = await getExtracted();
  const { data: cancellation } = await safeAsync(() => getWebPlusCancellation());

  return cancellation?.status === "ready" ? (
    <p>{t("Deleting your account ends Plus right away.")}</p>
  ) : null;
}
