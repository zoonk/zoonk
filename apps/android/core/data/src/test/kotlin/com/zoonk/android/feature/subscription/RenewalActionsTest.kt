package com.zoonk.android.feature.subscription

import org.junit.Assert.assertEquals
import org.junit.Test

class RenewalActionsTest {
    @Test fun failedRenewalOffersPaymentBeforeCancellation() {
        assertEquals(listOf(RenewalAction.UpdatePayment, RenewalAction.CancelPlus), renewalActions(true, true))
    }

    @Test fun aFailedRenewalCanBeRepairedWithoutCancellation() {
        assertEquals(listOf(RenewalAction.UpdatePayment), renewalActions(true, false))
    }

    @Test fun normalRenewalDoesNotNeedRepair() {
        assertEquals(listOf(RenewalAction.CancelPlus), renewalActions(false, true))
    }
}
