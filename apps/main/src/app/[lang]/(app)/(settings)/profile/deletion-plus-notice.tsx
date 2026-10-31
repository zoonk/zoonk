import { getAppLocale } from "@/i18n/locale";
import { getAccountDeletionRefund } from "@zoonk/core/subscriptions/web-plus-account-deletion";
import { getWebPlusCancellation } from "@zoonk/core/subscriptions/web-plus-cancellation";
import { formatPrice } from "@zoonk/utils/currency";
import { safeAsync } from "@zoonk/utils/error";
import { getExtracted } from "next-intl/server";

export async function DeletionPlusNotice() {
  const t = await getExtracted();
  const locale = await getAppLocale();
  const { data: cancellation } = await safeAsync(() => getWebPlusCancellation());

  if (cancellation?.status !== "ready") {
    return null;
  }

  const refund = getAccountDeletionRefund(cancellation);

  return (
    <p>
      {refund
        ? t("Your Plus ends right away, and we refund {amount} to the payment method you used.", {
            amount: formatPrice(refund.amount, refund.currency, locale),
          })
        : t("Your Plus ends right away, without a refund. You won't be charged again.")}
    </p>
  );
}
