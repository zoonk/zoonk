import { getWebPlusSubscription } from "@zoonk/core/subscriptions/get-web-plus-subscription";
import { safeAsync } from "@zoonk/utils/error";
import { getExtracted } from "next-intl/server";

export async function DeletionPlusNotice() {
  const t = await getExtracted();
  const { data: subscription } = await safeAsync(() => getWebPlusSubscription());

  return subscription?.status === "ready" ? (
    <p>{t("Deleting your account ends Plus right away.")}</p>
  ) : null;
}
