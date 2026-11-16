package com.zoonk.android.feature.subscription

import com.zoonk.android.R

enum class RenewalAction(
    val label: Int,
) {
    UpdatePayment(R.string.subscription_manage_google),
    CancelPlus(R.string.subscription_cancel),
}

fun renewalActions(
    paymentFailed: Boolean,
    canCancel: Boolean,
): List<RenewalAction> = listOfNotNull(RenewalAction.UpdatePayment.takeIf { paymentFailed }, RenewalAction.CancelPlus.takeIf { canCancel })
