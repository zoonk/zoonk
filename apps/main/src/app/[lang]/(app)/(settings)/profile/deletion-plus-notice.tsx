import { getActiveSubscription } from "@zoonk/core/auth/subscription";
import { getWebPlusSubscription } from "@zoonk/core/subscriptions/get-web-plus-subscription";
import { safeAsync } from "@zoonk/utils/error";
import { getExtracted } from "next-intl/server";

/** Only a store can end what it sells, so a store's subscriber is told to cancel there. */
export async function DeletionPlusNotice() {
  const t = await getExtracted();

  const [{ data: web }, { data: active }] = await Promise.all([
    safeAsync(() => getWebPlusSubscription()),
    safeAsync(() => getActiveSubscription()),
  ]);

  return (
    <>
      {web?.status === "ready" && <p>{t("Deleting your account ends Plus right away.")}</p>}
      {active?.provider === "apple" && (
        <p>{t("Plus from the App Store keeps charging until you cancel it there.")}</p>
      )}
      {active?.provider === "google" && (
        <p>{t("Plus from Google Play keeps charging until you cancel it there.")}</p>
      )}
    </>
  );
}
